import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  SearchTikTokProductsInput,
  SearchTikTokProductsOutput,
  TikTokShopProductSummary,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

function mapTikTokProduct(product: {
  id?: string;
  title?: string;
  status?: string;
  skus?: Array<unknown>;
  sales_regions?: string[];
  listing_quality_tier?: string;
  audit?: { status?: string };
}): TikTokShopProductSummary | undefined {
  if (typeof product.id !== "string" || typeof product.title !== "string" || typeof product.status !== "string") {
    return undefined;
  }

  return {
    id: product.id,
    title: product.title,
    status: product.status,
    skuCount: Array.isArray(product.skus) ? product.skus.length : 0,
    salesRegions: Array.isArray(product.sales_regions) ? product.sales_regions.filter((region): region is string => typeof region === "string") : [],
    listingQualityTier: product.listing_quality_tier,
    auditStatus: product.audit?.status,
  };
}

export async function search_tiktok_products(
  input: SearchTikTokProductsInput,
  context: AgentToolExecutionContext,
): Promise<SearchTikTokProductsOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
    shopCipher: input.shopCipher,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.product.searchProducts({
      query: {
        page_size: Math.max(1, Math.min(input.pageSize ?? 20, 100)),
        page_token: input.pageToken,
      },
      body: {
        status: input.status,
        seller_skus: input.sellerSkus,
      },
    });

    const products = (response.data?.products ?? []).map(mapTikTokProduct).filter((product): product is TikTokShopProductSummary => Boolean(product));

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/product/202502/products/search`,
      totalCount: response.data?.total_count ?? products.length,
      nextPageToken: response.data?.next_page_token,
      products,
    };
  });
}

export const searchTikTokProductsTool: AgentToolDefinition<
  "search_tiktok_products",
  SearchTikTokProductsInput,
  SearchTikTokProductsOutput
> = {
  name: "search_tiktok_products",
  description: "Search TikTok Shop products for the authorized shop to inspect listing state and duplicates.",
  stage: "listing",
  risk: "low",
  requiresApproval: false,
  execute: search_tiktok_products,
};