import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  DeactivateTikTokProductsInput,
  DeactivateTikTokProductsOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function deactivate_tiktok_products(
  input: DeactivateTikTokProductsInput,
  context: AgentToolExecutionContext,
): Promise<DeactivateTikTokProductsOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    await sdk.product.deactivateProducts({
      product_ids: input.productIds,
      listing_platforms: ["TIKTOK_SHOP"],
    });

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/products/deactivate`,
      productIds: input.productIds,
    };
  });
}

export const deactivateTikTokProductsTool: AgentToolDefinition<
  "deactivate_tiktok_products",
  DeactivateTikTokProductsInput,
  DeactivateTikTokProductsOutput
> = {
  name: "deactivate_tiktok_products",
  description: "Deactivate TikTok Shop products so the agent can pivot away from weak or problematic listings.",
  stage: "pivoting",
  risk: "medium",
  requiresApproval: false,
  execute: deactivate_tiktok_products,
};