import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjAccessTokenOutput,
  GetCjAccessTokenInput,
} from "@/agent/core/tools";

const DEFAULT_CJ_GET_ACCESS_TOKEN_URL = "https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken";

function parseTokenPayload(payload: {
  data?: {
    openId?: number;
    accessToken?: string;
    accessTokenExpiryDate?: string;
    refreshToken?: string;
    refreshTokenExpiryDate?: string;
    createDate?: string;
  };
}): Omit<CjAccessTokenOutput, "fetchedAt" | "sourceUrl"> {
  const data = payload.data;

  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.accessTokenExpiryDate !== "string" ||
    typeof data.refreshToken !== "string" ||
    typeof data.refreshTokenExpiryDate !== "string"
  ) {
    throw new Error("CJ access token response did not include usable token fields.");
  }

  return {
    openId: typeof data.openId === "number" ? data.openId : undefined,
    accessToken: data.accessToken,
    accessTokenExpiryDate: data.accessTokenExpiryDate,
    refreshToken: data.refreshToken,
    refreshTokenExpiryDate: data.refreshTokenExpiryDate,
    createdAt: typeof data.createDate === "string" ? data.createDate : undefined,
  };
}

export async function get_cj_access_token(
  input: GetCjAccessTokenInput,
  context: AgentToolExecutionContext,
): Promise<CjAccessTokenOutput> {
  const url = input.pageUrl ?? DEFAULT_CJ_GET_ACCESS_TOKEN_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
    },
    body: JSON.stringify({
      apiKey: input.apiKey,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get CJ access token: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as Parameters<typeof parseTokenPayload>[0];
  const tokenData = parseTokenPayload(payload);

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    ...tokenData,
  };
}

export const getCjAccessTokenTool: AgentToolDefinition<
  "get_cj_access_token",
  GetCjAccessTokenInput,
  CjAccessTokenOutput
> = {
  name: "get_cj_access_token",
  description: "Exchange a CJ API key for access and refresh tokens.",
  stage: "product_creation",
  risk: "medium",
  requiresApproval: false,
  execute: get_cj_access_token,
};