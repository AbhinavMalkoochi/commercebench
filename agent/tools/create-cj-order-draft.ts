import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjOrderDraftInterceptionReason,
  CjOrderDraftProductInfo,
  CreateCjOrderDraftInput,
  CreateCjOrderDraftOutput,
} from "@/agent/core/tools";

const DEFAULT_CJ_CREATE_ORDER_DRAFT_URL = "https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2";

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

function parseProductInfoList(value: unknown): CjOrderDraftProductInfo[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => {
    const item = entry as {
      storeLineItemId?: unknown;
      lineItemId?: unknown;
      variantId?: unknown;
      quantity?: unknown;
      isGroup?: unknown;
    };

    return {
      storeLineItemId: typeof item.storeLineItemId === "string" ? item.storeLineItemId : undefined,
      lineItemId: typeof item.lineItemId === "string" ? item.lineItemId : undefined,
      variantId: typeof item.variantId === "string" ? item.variantId : undefined,
      quantity: toNumber(item.quantity),
      isGroup: typeof item.isGroup === "boolean" ? item.isGroup : undefined,
    };
  });
}

function parseInterceptionReasons(value: unknown): CjOrderDraftInterceptionReason[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((entry) => {
    const item = entry as { code?: unknown; message?: unknown };
    const code = toNumber(item.code);
    const message = typeof item.message === "string" ? item.message : undefined;

    if (typeof code !== "number" || typeof message !== "string") {
      return [];
    }

    return [{ code, message }];
  });
}

export async function create_cj_order_draft(
  input: CreateCjOrderDraftInput,
  context: AgentToolExecutionContext,
): Promise<CreateCjOrderDraftOutput> {
  const url = input.pageUrl ?? DEFAULT_CJ_CREATE_ORDER_DRAFT_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "CJ-Access-Token": input.accessToken,
      platformToken: input.platformToken ?? "",
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
    },
    body: JSON.stringify({
      orderNumber: input.orderNumber,
      shippingZip: input.shippingZip,
      shippingCountryCode: input.shippingCountryCode,
      shippingCountry: input.shippingCountry,
      shippingProvince: input.shippingProvince,
      shippingCity: input.shippingCity,
      shippingCounty: input.shippingCounty,
      shippingPhone: input.shippingPhone,
      shippingCustomerName: input.shippingCustomerName,
      shippingAddress: input.shippingAddress,
      shippingAddress2: input.shippingAddress2,
      houseNumber: input.houseNumber,
      email: input.email,
      taxId: input.taxId,
      remark: input.remark,
      consigneeID: input.consigneeId,
      payType: 3,
      shopAmount: input.shopAmount,
      logisticName: input.logisticName,
      fromCountryCode: input.fromCountryCode,
      iossType: input.iossType,
      iossNumber: input.iossNumber,
      platform: input.platform,
      shopLogisticsType: input.shopLogisticsType,
      storageId: input.storageId,
      storeName: input.storeName,
      storeOrderTime: input.storeOrderTimeSeconds,
      products: input.products.map((product) => ({
        vid: product.vid,
        sku: product.sku,
        quantity: product.quantity,
        unitPrice: product.unitPrice,
        storeLineItemId: product.storeLineItemId,
      })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create CJ order draft: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: {
      orderId?: unknown;
      orderNumber?: unknown;
      shipmentOrderId?: unknown;
      orderStatus?: unknown;
      actualPayment?: unknown;
      orderAmount?: unknown;
      cjPayUrl?: unknown;
      logisticsMiss?: unknown;
      productInfoList?: unknown;
      interceptOrderReasons?: unknown;
    };
  };

  const data = payload.data ?? {};

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    orderId: typeof data.orderId === "string" ? data.orderId : undefined,
    orderNumber: typeof data.orderNumber === "string" ? data.orderNumber : undefined,
    shipmentOrderId: typeof data.shipmentOrderId === "string" ? data.shipmentOrderId : undefined,
    orderStatus: typeof data.orderStatus === "string" ? data.orderStatus : undefined,
    actualPayment: toNumber(data.actualPayment),
    orderAmount: toNumber(data.orderAmount),
    cjPayUrl: typeof data.cjPayUrl === "string" ? data.cjPayUrl : undefined,
    logisticsMissing: typeof data.logisticsMiss === "boolean" ? data.logisticsMiss : undefined,
    productInfoList: parseProductInfoList(data.productInfoList),
    interceptOrderReasons: parseInterceptionReasons(data.interceptOrderReasons),
  };
}

export const createCjOrderDraftTool: AgentToolDefinition<
  "create_cj_order_draft",
  CreateCjOrderDraftInput,
  CreateCjOrderDraftOutput
> = {
  name: "create_cj_order_draft",
  description: "Create an unpaid CJ supplier order draft using payType=3 so payment can stay manual-only.",
  stage: "product_creation",
  risk: "medium",
  requiresApproval: false,
  execute: create_cj_order_draft,
};