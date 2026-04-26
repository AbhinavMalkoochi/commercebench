import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjOrderLineItem,
  GetCjOrderDetailInput,
  GetCjOrderDetailOutput,
} from "@/agent/core/tools";

const DEFAULT_CJ_ORDER_DETAIL_URL = "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/getOrderDetail";

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

function mapProduct(value: unknown): CjOrderLineItem | undefined {
  const item = value as Record<string, unknown>;
  const lineItemId = typeof item.lineItemId === "string" ? item.lineItemId : undefined;
  const variantId = typeof item.variantId === "string" ? item.variantId : undefined;

  if (!lineItemId && !variantId) {
    return undefined;
  }

  return {
    lineItemId,
    variantId,
    quantity: toNumber(item.quantity),
    sku: typeof item.sku === "string" ? item.sku : undefined,
    productName: typeof item.productName === "string" ? item.productName : undefined,
  };
}

export async function get_cj_order_detail(
  input: GetCjOrderDetailInput,
  context: AgentToolExecutionContext,
): Promise<GetCjOrderDetailOutput> {
  const url = new URL(input.pageUrl ?? DEFAULT_CJ_ORDER_DETAIL_URL);
  url.searchParams.set("orderId", input.orderId);

  const response = await (context.fetchImpl ?? fetch)(url, {
    headers: {
      "CJ-Access-Token": input.accessToken,
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get CJ order detail: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { data?: Record<string, unknown> };
  const data = payload.data ?? {};

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    orderId: input.orderId,
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : undefined,
    shipmentOrderId: typeof data.shipmentOrderId === "string" ? data.shipmentOrderId : undefined,
    orderStatus: typeof data.orderStatus === "string" ? data.orderStatus : undefined,
    shippingCountryCode: typeof data.shippingCountryCode === "string" ? data.shippingCountryCode : undefined,
    shippingProvince: typeof data.shippingProvince === "string" ? data.shippingProvince : undefined,
    shippingCity: typeof data.shippingCity === "string" ? data.shippingCity : undefined,
    shippingCustomerName: typeof data.shippingCustomerName === "string" ? data.shippingCustomerName : undefined,
    shippingAddress: typeof data.shippingAddress === "string" ? data.shippingAddress : undefined,
    shippingZip: typeof data.shippingZip === "string" ? data.shippingZip : undefined,
    actualPayment: toNumber(data.actualPayment),
    orderAmount: toNumber(data.orderAmount),
    logisticName: typeof data.logisticName === "string" ? data.logisticName : undefined,
    trackNumber: typeof data.trackNumber === "string" ? data.trackNumber : undefined,
    createDate: typeof data.createDate === "string" ? data.createDate : undefined,
    paymentDate: typeof data.paymentDate === "string" ? data.paymentDate : undefined,
    products: Array.isArray(data.productList)
      ? data.productList.map(mapProduct).filter((entry): entry is CjOrderLineItem => Boolean(entry))
      : [],
  };
}

export const getCjOrderDetailTool: AgentToolDefinition<"get_cj_order_detail", GetCjOrderDetailInput, GetCjOrderDetailOutput> = {
  name: "get_cj_order_detail",
  description: "Get CJ order details so the agent can inspect status, shipment, and tracking for a synced order.",
  stage: "monitoring",
  risk: "low",
  requiresApproval: false,
  execute: get_cj_order_detail,
};