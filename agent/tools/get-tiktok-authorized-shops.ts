import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetTikTokAuthorizedShopsInput,
  GetTikTokAuthorizedShopsOutput,
  TikTokAuthorizedShop,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_OPEN_API_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

function mapAuthorizedShop(shop: {
  id?: string;
  cipher?: string;
  code?: string;
  name?: string;
  region?: string;
  seller_type?: string;
}): TikTokAuthorizedShop | undefined {
  if (typeof shop.id !== "string" || typeof shop.cipher !== "string") {
    return undefined;
  }

  return {
    id: shop.id,
    cipher: shop.cipher,
    code: shop.code,
    name: shop.name,
    region: shop.region,
    sellerType: shop.seller_type,
  };
}

export async function get_tiktok_authorized_shops(
  input: GetTikTokAuthorizedShopsInput,
  context: AgentToolExecutionContext,
): Promise<GetTikTokAuthorizedShopsOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
    accessToken: input.accessToken,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.shop.getAuthorizedShops();
    const shops = (response.data?.shops ?? []).map(mapAuthorizedShop).filter((shop): shop is TikTokAuthorizedShop => Boolean(shop));

    return {
      fetchedAt: context.now.toISOString(),
      sourceUrl: `${TIKTOK_SHOP_OPEN_API_URL}/authorization/202309/shops`,
      shops,
    };
  });
}

export const getTikTokAuthorizedShopsTool: AgentToolDefinition<
  "get_tiktok_authorized_shops",
  GetTikTokAuthorizedShopsInput,
  GetTikTokAuthorizedShopsOutput
> = {
  name: "get_tiktok_authorized_shops",
  description: "Retrieve the TikTok Shop accounts authorized for the current app and access token.",
  stage: "listing",
  risk: "low",
  requiresApproval: false,
  execute: get_tiktok_authorized_shops,
};