import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetTikTokAccessTokenInput,
  TikTokAccessTokenOutput,
} from "@/agent/core/tools";
import { createTikTokShopSdk, TIKTOK_SHOP_AUTH_URL, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

function mapTikTokAccessTokenOutput(
  data: {
    access_token?: string;
    refresh_token?: string;
    access_token_expire_in?: number;
    refresh_token_expire_in?: number;
    open_id?: string;
    seller_name?: string;
  },
  now: Date,
): TikTokAccessTokenOutput {
  if (typeof data.access_token !== "string" || typeof data.refresh_token !== "string") {
    throw new Error("TikTok Shop token response did not include usable access and refresh tokens.");
  }

  return {
    fetchedAt: now.toISOString(),
    sourceUrl: TIKTOK_SHOP_AUTH_URL,
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessTokenExpireInSeconds: data.access_token_expire_in,
    refreshTokenExpireInSeconds: data.refresh_token_expire_in,
    openId: data.open_id,
    sellerName: data.seller_name,
  };
}

export async function get_tiktok_access_token(
  input: GetTikTokAccessTokenInput,
  context: AgentToolExecutionContext,
): Promise<TikTokAccessTokenOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.auth.getAccessToken({
      auth_code: input.authCode,
      grant_type: "authorized_code",
    });

    return mapTikTokAccessTokenOutput(response.data ?? {}, context.now);
  });
}

export const getTikTokAccessTokenTool: AgentToolDefinition<
  "get_tiktok_access_token",
  GetTikTokAccessTokenInput,
  TikTokAccessTokenOutput
> = {
  name: "get_tiktok_access_token",
  description: "Exchange a TikTok Shop authorization code for access and refresh tokens.",
  stage: "listing",
  risk: "medium",
  requiresApproval: false,
  execute: get_tiktok_access_token,
};

export { mapTikTokAccessTokenOutput };