import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  RefreshTikTokAccessTokenInput,
  TikTokAccessTokenOutput,
} from "@/agent/core/tools";
import { mapTikTokAccessTokenOutput } from "@/agent/tools/get-tiktok-access-token";
import { createTikTokShopSdk, withTikTokFetchOverride } from "@/agent/tools/tiktok-shop-sdk";

export async function refresh_tiktok_access_token(
  input: RefreshTikTokAccessTokenInput,
  context: AgentToolExecutionContext,
): Promise<TikTokAccessTokenOutput> {
  const sdk = createTikTokShopSdk({
    appKey: input.appKey,
    appSecret: input.appSecret,
  });

  return withTikTokFetchOverride(context, async () => {
    const response = await sdk.auth.refreshAccessToken({
      refresh_token: input.refreshToken,
      grant_type: "refresh_token",
    });

    return mapTikTokAccessTokenOutput(response.data ?? {}, context.now);
  });
}

export const refreshTikTokAccessTokenTool: AgentToolDefinition<
  "refresh_tiktok_access_token",
  RefreshTikTokAccessTokenInput,
  TikTokAccessTokenOutput
> = {
  name: "refresh_tiktok_access_token",
  description: "Refresh a TikTok Shop access token using a refresh token.",
  stage: "listing",
  risk: "low",
  requiresApproval: false,
  execute: refresh_tiktok_access_token,
};