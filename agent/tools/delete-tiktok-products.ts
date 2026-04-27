import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  DeleteTikTokProductsInput,
  DeleteTikTokProductsOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function delete_tiktok_products(
  input: DeleteTikTokProductsInput,
  context: AgentToolExecutionContext,
): Promise<DeleteTikTokProductsOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    await sdk.product.deleteProducts({
      product_ids: input.productIds,
    });

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202309/products/delete`,
      productIds: input.productIds,
    };
  });
}

export const deleteTikTokProductsTool: AgentToolDefinition<
  "delete_tiktok_products",
  DeleteTikTokProductsInput,
  DeleteTikTokProductsOutput
> = {
  name: "delete_tiktok_products",
  description: "Delete TikTok Shop products after a pivot or cleanup step removes them from the catalog entirely.",
  stage: "pivoting",
  risk: "high",
  requiresApproval: true,
  execute: delete_tiktok_products,
};