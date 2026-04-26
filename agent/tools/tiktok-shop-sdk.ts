import { TikTokShopSDK } from "tiktok-shop-sdk";

import { AgentToolExecutionContext } from "@/agent/core/tools";

export const TIKTOK_SHOP_OPEN_API_URL = "https://open-api.tiktokglobalshop.com";
export const TIKTOK_SHOP_AUTH_URL = "https://auth.tiktok-shops.com/api/v2/token/get";

export function createTikTokShopSdk(input: {
  appKey: string;
  appSecret: string;
  accessToken?: string;
  shopCipher?: string;
}): TikTokShopSDK {
  const sdk = new TikTokShopSDK({
    appKey: input.appKey,
    appSecret: input.appSecret,
    baseURL: TIKTOK_SHOP_OPEN_API_URL,
  });

  if (input.accessToken) {
    sdk.setAccessToken(input.accessToken);
  }

  if (input.shopCipher) {
    sdk.setShopCipher(input.shopCipher);
  }

  return sdk;
}

export async function withTikTokFetchOverride<T>(
  context: AgentToolExecutionContext,
  run: () => Promise<T>,
): Promise<T> {
  if (!context.fetchImpl) {
    return run();
  }

  const originalFetch = globalThis.fetch;
  globalThis.fetch = context.fetchImpl;

  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}