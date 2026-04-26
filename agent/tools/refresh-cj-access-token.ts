import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjAccessTokenOutput,
  RefreshCjAccessTokenInput,
} from "@/agent/core/tools";

const DEFAULT_CJ_REFRESH_ACCESS_TOKEN_URL = "https://developers.cjdropshipping.com/api2.0/v1/authentication/refreshAccessToken";

function parseTokenPayload(payload: {
  data?: {
    accessToken?: string;
    accessTokenExpiryDate?: string;
    refreshToken?: string;
    refreshTokenExpiryDate?: string;
    createDate?: string;
  };
}): Omit<CjAccessTokenOutput, "fetchedAt" | "sourceUrl" | "openId"> {
  const data = payload.data;

  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.accessTokenExpiryDate !== "string" ||
    typeof data.refreshToken !== "string" ||
    typeof data.refreshTokenExpiryDate !== "string"
  ) {
    throw new Error("CJ refresh token response did not include usable token fields.");
  }

  return {
    accessToken: data.accessToken,
    accessTokenExpiryDate: data.accessTokenExpiryDate,
    refreshToken: data.refreshToken,
    refreshTokenExpiryDate: data.refreshTokenExpiryDate,
    createdAt: typeof data.createDate === "string" ? data.createDate : undefined,
  };
}

export async function refresh_cj_access_token(
  input: RefreshCjAccessTokenInput,
  context: AgentToolExecutionContext,
): Promise<CjAccessTokenOutput> {
  const url = input.pageUrl ?? DEFAULT_CJ_REFRESH_ACCESS_TOKEN_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
    },
    body: JSON.stringify({
      refreshToken: input.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh CJ access token: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as Parameters<typeof parseTokenPayload>[0];
  const tokenData = parseTokenPayload(payload);

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    ...tokenData,
  };
}

export const refreshCjAccessTokenTool: AgentToolDefinition<
  "refresh_cj_access_token",
  RefreshCjAccessTokenInput,
  CjAccessTokenOutput
> = {
  name: "refresh_cj_access_token",
  description: "Refresh a CJ access token using a CJ refresh token.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: refresh_cj_access_token,
};