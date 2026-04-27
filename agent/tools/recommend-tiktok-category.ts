import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  RecommendTikTokCategoryInput,
  RecommendTikTokCategoryOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function recommend_tiktok_category(
  input: RecommendTikTokCategoryInput,
  context: AgentToolExecutionContext,
): Promise<RecommendTikTokCategoryOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.product.recommendCategory({
      product_title: input.title,
      description: input.description,
      images: input.imageUrls?.map((url) => ({ url })),
      category_version: "v2",
      listing_platform: "TIKTOK_SHOP",
      include_prohibited_categories: false,
    });

    const leafCategoryId = response.data?.leaf_category_id;
    if (!leafCategoryId) {
      throw new Error("TikTok category recommendation did not return a leaf category id.");
    }

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/categories/recommend`,
      categoryId: leafCategoryId,
      categoryPath: (response.data?.categories ?? []).map((category) => category.name).filter((name): name is string => typeof name === "string"),
    };
  });
}

export const recommendTikTokCategoryTool: AgentToolDefinition<
  "recommend_tiktok_category",
  RecommendTikTokCategoryInput,
  RecommendTikTokCategoryOutput
> = {
  name: "recommend_tiktok_category",
  description: "Recommend the best TikTok Shop category for a product title, description, and image set.",
  stage: "listing",
  risk: "low",
  requiresApproval: false,
  execute: recommend_tiktok_category,
};