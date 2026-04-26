import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjOrderListItem,
  GetCjOrdersInput,
  GetCjOrdersOutput,
} from "@/agent/core/tools";

const DEFAULT_CJ_ORDER_LIST_URL = "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/list";

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function toCsv(value: string[] | undefined): string | undefined {
  if (!value || value.length === 0) {
    return undefined;
  }

  return value.join(",");
}

function mapOrder(value: unknown): CjOrderListItem | undefined {
  const item = value as Record<string, unknown>;
  const orderId = typeof item.orderId === "string" ? item.orderId : undefined;

  if (!orderId) {
    return undefined;
  }

  return {
    orderId,
    orderNumber: typeof item.orderNumber === "string" ? item.orderNumber : undefined,
    shipmentOrderId: typeof item.shipmentOrderId === "string" ? item.shipmentOrderId : undefined,
    orderStatus: typeof item.orderStatus === "string" ? item.orderStatus : undefined,
    shippingCountryCode: typeof item.shippingCountryCode === "string" ? item.shippingCountryCode : undefined,
    shippingProvince: typeof item.shippingProvince === "string" ? item.shippingProvince : undefined,
    shippingCity: typeof item.shippingCity === "string" ? item.shippingCity : undefined,
    shippingCustomerName: typeof item.shippingCustomerName === "string" ? item.shippingCustomerName : undefined,
    orderAmount: toNumber(item.orderAmount),
    actualPayment: toNumber(item.actualPayment),
    logisticName: typeof item.logisticName === "string" ? item.logisticName : undefined,
    trackNumber: typeof item.trackNumber === "string" ? item.trackNumber : undefined,
    createDate: typeof item.createDate === "string" ? item.createDate : undefined,
  };
}

export async function get_cj_orders(
  input: GetCjOrdersInput,
  context: AgentToolExecutionContext,
): Promise<GetCjOrdersOutput> {
  const url = new URL(input.pageUrl ?? DEFAULT_CJ_ORDER_LIST_URL);
  url.searchParams.set("pageNum", String(Math.max(1, input.pageNum ?? 1)));
  url.searchParams.set("pageSize", String(Math.max(1, Math.min(input.pageSize ?? 20, 100))));

  const orderIds = toCsv(input.orderIds);
  if (orderIds) {
    url.searchParams.set("orderIds", orderIds);
  }

  if (input.shipmentOrderId) {
    url.searchParams.set("shipmentOrderId", input.shipmentOrderId);
  }

  if (input.status) {
    url.searchParams.set("status", input.status);
  }

  const response = await (context.fetchImpl ?? fetch)(url, {
    headers: {
      "CJ-Access-Token": input.accessToken,
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list CJ orders: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: {
      pageNum?: unknown;
      pageSize?: unknown;
      total?: unknown;
      list?: unknown[];
    };
  };

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    pageNum: toNumber(payload.data?.pageNum),
    pageSize: toNumber(payload.data?.pageSize),
    total: toNumber(payload.data?.total),
    orders: Array.isArray(payload.data?.list)
      ? payload.data.list.map(mapOrder).filter((entry): entry is CjOrderListItem => Boolean(entry))
      : [],
  };
}

export const getCjOrdersTool: AgentToolDefinition<"get_cj_orders", GetCjOrdersInput, GetCjOrdersOutput> = {
  name: "get_cj_orders",
  description: "List CJ orders so the agent can reconcile unpaid drafts, shipment state, and tracking data.",
  stage: "monitoring",
  risk: "low",
  requiresApproval: false,
  execute: get_cj_orders,
};