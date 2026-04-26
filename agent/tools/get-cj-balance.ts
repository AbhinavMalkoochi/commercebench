import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetCjBalanceInput,
  GetCjBalanceOutput,
} from "@/agent/core/tools";

const DEFAULT_CJ_GET_BALANCE_URL = "https://developers.cjdropshipping.com/api2.0/v1/shopping/pay/getBalance";

function parseBalance(payload: { data?: unknown }): number {
  const data = payload.data;

  if (typeof data === "number") {
    return data;
  }

  if (typeof data === "string") {
    const parsed = Number(data);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (data && typeof data === "object") {
    const balance = (data as { balance?: unknown }).balance;
    if (typeof balance === "number") {
      return balance;
    }
    if (typeof balance === "string") {
      const parsed = Number(balance);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  throw new Error("CJ balance response did not include a usable balance value.");
}

export async function get_cj_balance(
  input: GetCjBalanceInput,
  context: AgentToolExecutionContext,
): Promise<GetCjBalanceOutput> {
  const url = input.pageUrl ?? DEFAULT_CJ_GET_BALANCE_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      "CJ-Access-Token": input.accessToken,
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get CJ balance: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: unknown };

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    balance: parseBalance(payload),
    currency: "USD",
  };
}

export const getCjBalanceTool: AgentToolDefinition<
  "get_cj_balance",
  GetCjBalanceInput,
  GetCjBalanceOutput
> = {
  name: "get_cj_balance",
  description: "Fetch the CJ wallet balance before attempting any supplier payment.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: get_cj_balance,
};