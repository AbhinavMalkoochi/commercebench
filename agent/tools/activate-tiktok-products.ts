import {
  ActivateTikTokProductsInput,
  ActivateTikTokProductsOutput,
  AgentToolDefinition,
  AgentToolExecutionContext,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function activate_tiktok_products(
  input: ActivateTikTokProductsInput,
  context: AgentToolExecutionContext,
): Promise<ActivateTikTokProductsOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    await sdk.product.activateProducts({
      product_ids: input.productIds,
      listing_platforms: ["TIKTOK_SHOP"],
    });

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/products/activate`,
      productIds: input.productIds,
    };
  });
}

export const activateTikTokProductsTool: AgentToolDefinition<
  "activate_tiktok_products",
  ActivateTikTokProductsInput,
  ActivateTikTokProductsOutput
> = {
  name: "activate_tiktok_products",
  description: "Activate TikTok Shop products so prepared listings go live on the selling platform.",
  stage: "listing",
  risk: "medium",
  requiresApproval: false,
  execute: activate_tiktok_products,
};