import { createHash } from "node:crypto";

import { readRecentTikTokWebhooks, StoredTikTokWebhook } from "@/app/tiktok-webhook-store";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import {
  AgentToolExecutionContext,
  CreateCjOrderDraftInput,
  SearchTikTokOrdersOutput,
} from "@/agent/core/tools";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { ToolExecutor } from "@/agent/core/tool-executor";
import {
  CjOrderReconciliationEntry,
  ObservedTikTokOrder,
  OrderSyncResult,
  SyncedCjOrderDraft,
} from "@/agent/core/types";

export interface OrderSyncConfig {
  tikTok?: {
    appKey: string;
    appSecret: string;
    accessToken: string;
    shopCipher: string;
  };
  cj?: {
    accessToken: string;
    defaultLogisticName: string;
    fromCountryCode: string;
    platform?: string;
    storeName?: string;
  };
}

function toObject(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function toText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

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

function normalizeCountryCode(value?: string): string {
  return value && value.length >= 2 ? value.slice(0, 2).toUpperCase() : "US";
}

function normalizeCountry(value?: string): string {
  if (!value) {
    return "United States";
  }

  if (value.toUpperCase() === "US") {
    return "United States";
  }

  return value;
}

function safeOrderNumber(orderId: string): string {
  const hash = createHash("sha1").update(orderId).digest("hex").slice(0, 12).toUpperCase();
  return `TT-${hash}`;
}

function parseWebhookSummary(webhook: StoredTikTokWebhook): ObservedTikTokOrder | undefined {
  const payloadData = toObject(webhook.payload.data);
  const orderId = toText(payloadData?.order_id) ?? toText(webhook.payload.order_id);

  if (!orderId) {
    return undefined;
  }

  return {
    source: "webhook",
    observedAt: webhook.receivedAt,
    orderId,
    status: toText(payloadData?.order_status) ?? toText(webhook.payload.order_status),
    rawType: webhook.type,
    products: [],
  };
}

function parseWebhookDetail(webhook: StoredTikTokWebhook): ObservedTikTokOrder | undefined {
  const data = toObject(webhook.payload.data);
  const order = toObject(data?.order);
  const orderId = toText(order?.id) ?? toText(data?.order_id);

  if (!orderId) {
    return undefined;
  }

  const recipient = toObject(order?.recipient_address);
  const lineItems = Array.isArray(order?.line_items) ? order.line_items : [];

  return {
    source: "webhook",
    observedAt: webhook.receivedAt,
    orderId,
    status: toText(order?.status) ?? toText(data?.order_status),
    rawType: webhook.type,
    shippingCountryCode: normalizeCountryCode(toText(recipient?.region_code)),
    shippingCountry: normalizeCountry(toText(recipient?.region_code)),
    shippingZip: toText(recipient?.postal_code),
    shippingPhone: toText(recipient?.phone_number),
    shippingCustomerName: toText(recipient?.name),
    shippingAddress: toText(recipient?.full_address) ?? toText(recipient?.address_detail),
    email: toText(order?.buyer_email),
    products: lineItems.flatMap((entry) => {
      const item = toObject(entry);
      return [{
        sellerSku: toText(item?.seller_sku),
        skuId: toText(item?.sku_id),
        productName: toText(item?.product_name),
        quantity: toNumber(item?.quantity) ?? 1,
        salePrice: toText(item?.sale_price),
      }];
    }),
  };
}

function parseSearchOrders(search: SearchTikTokOrdersOutput): ObservedTikTokOrder[] {
  return search.orders.map((order) => ({
    source: "search",
    observedAt: search.fetchedAt,
    orderId: order.id,
    status: order.status,
    shippingAddress: order.recipientFullAddress,
    email: order.buyerEmail,
    products: [],
  }));
}

function buildDraftInput(order: ObservedTikTokOrder, config: NonNullable<OrderSyncConfig["cj"]>): CreateCjOrderDraftInput | undefined {
  const products = order.products
    .filter((product) => product.sellerSku || product.skuId)
    .map((product, index) => ({
      sku: product.sellerSku,
      vid: product.skuId,
      quantity: product.quantity,
      unitPrice: toNumber(product.salePrice),
      storeLineItemId: `${order.orderId}-${index + 1}`,
    }));

  if (products.length === 0 || !order.shippingAddress || !order.shippingCustomerName) {
    return undefined;
  }

  return {
    accessToken: config.accessToken,
    orderNumber: safeOrderNumber(order.orderId),
    shippingCountryCode: normalizeCountryCode(order.shippingCountryCode),
    shippingCountry: normalizeCountry(order.shippingCountry),
    shippingProvince: order.shippingProvince ?? "Unknown",
    shippingCity: order.shippingCity ?? "Unknown",
    shippingCounty: order.shippingCounty,
    shippingZip: order.shippingZip,
    shippingPhone: order.shippingPhone,
    shippingCustomerName: order.shippingCustomerName,
    shippingAddress: order.shippingAddress,
    shippingAddress2: order.shippingAddress2,
    email: order.email,
    logisticName: config.defaultLogisticName,
    fromCountryCode: config.fromCountryCode,
    products,
    platform: config.platform ?? "TikTokShop",
    storeName: config.storeName,
    storeOrderTimeSeconds: Math.floor(new Date(order.observedAt).getTime() / 1000),
  };
}

export class OrderSync {
  private readonly executor = new ToolExecutor(createDefaultToolRegistry());
  private readonly policy = new DefaultToolPolicy();

  async run(input: { config?: OrderSyncConfig; toolContext: AgentToolExecutionContext }): Promise<OrderSyncResult> {
    if (!input.config?.cj?.accessToken) {
      return {
        status: "skipped",
        reasoning: "CJ order-sync credentials are not configured.",
        observedOrders: [],
        createdDrafts: [],
        reconciledOrders: [],
      };
    }

    const observedOrders: ObservedTikTokOrder[] = [];
    const recentWebhooks = await readRecentTikTokWebhooks(12);
    for (const webhook of recentWebhooks) {
      const detailed = parseWebhookDetail(webhook);
      if (detailed) {
        observedOrders.push(detailed);
        continue;
      }

      const summary = parseWebhookSummary(webhook);
      if (summary) {
        observedOrders.push(summary);
      }
    }

    if (input.config.tikTok) {
      const searchDecision = this.policy.evaluate(this.executor.getToolDefinition("search_tiktok_orders"), {
        stage: "monitoring",
      });

      if (searchDecision.allowed) {
        const search = await this.executor.execute(
          "search_tiktok_orders",
          {
            appKey: input.config.tikTok.appKey,
            appSecret: input.config.tikTok.appSecret,
            accessToken: input.config.tikTok.accessToken,
            shopCipher: input.config.tikTok.shopCipher,
            orderStatus: "AWAITING_SHIPMENT",
            pageSize: 10,
          },
          input.toolContext,
        );

        observedOrders.push(...parseSearchOrders(search));
      }
    }

    const uniqueOrders = Array.from(new Map(observedOrders.map((order) => [order.orderId, order])).values());
    const createdDrafts: SyncedCjOrderDraft[] = [];
    const reconciledOrders: CjOrderReconciliationEntry[] = [];
    const monitoringDecision = this.policy.evaluate(this.executor.getToolDefinition("get_cj_orders"), { stage: "monitoring" });
    const detailDecision = this.policy.evaluate(this.executor.getToolDefinition("get_cj_order_detail"), { stage: "monitoring" });
    const createDecision = this.policy.evaluate(this.executor.getToolDefinition("create_cj_order_draft"), { stage: "product_creation" });

    const cjOrders = monitoringDecision.allowed
      ? await this.executor.execute(
          "get_cj_orders",
          {
            accessToken: input.config.cj.accessToken,
            pageNum: 1,
            pageSize: 50,
            status: "UNPAID",
          },
          input.toolContext,
        )
      : { orders: [] };

    for (const order of uniqueOrders) {
      const existingOrder = cjOrders.orders.find((entry) => entry.orderNumber === safeOrderNumber(order.orderId));

      if (!existingOrder && createDecision.allowed) {
        const draftInput = buildDraftInput(order, input.config.cj);
        if (draftInput) {
          const draft = await this.executor.execute("create_cj_order_draft", draftInput, input.toolContext);
          createdDrafts.push({
            sourceOrderId: order.orderId,
            observedSource: order.source,
            orderStatus: order.status,
            cjOrderId: draft.orderId,
            cjOrderNumber: draft.orderNumber,
            cjShipmentOrderId: draft.shipmentOrderId,
            cjPayUrl: draft.cjPayUrl,
            actualPayment: draft.actualPayment,
            orderAmount: draft.orderAmount,
            logisticsMissing: draft.logisticsMissing,
            interceptOrderReasons: draft.interceptOrderReasons,
          });
        }
      }

      const currentOrderId = existingOrder?.orderId ?? createdDrafts.find((entry) => entry.sourceOrderId === order.orderId)?.cjOrderId;

      if (currentOrderId && detailDecision.allowed) {
        const detail = await this.executor.execute(
          "get_cj_order_detail",
          {
            accessToken: input.config.cj.accessToken,
            orderId: currentOrderId,
          },
          input.toolContext,
        );

        reconciledOrders.push({
          sourceOrderId: order.orderId,
          cjOrderId: detail.orderId,
          cjOrderStatus: detail.orderStatus,
          cjShipmentOrderId: detail.shipmentOrderId,
          cjTrackingNumber: detail.trackNumber,
          cjLogisticName: detail.logisticName,
          shippingCountryCode: detail.shippingCountryCode,
          note: detail.trackNumber
            ? `CJ order ${detail.orderId} has tracking ${detail.trackNumber}.`
            : `CJ order ${detail.orderId} is ${detail.orderStatus ?? "unknown"}.`,
        });
      }
    }

    return {
      status: uniqueOrders.length > 0 ? "ready" : "skipped",
      reasoning: uniqueOrders.length > 0
        ? "Observed TikTok orders were scanned, unmatched orders were converted into unpaid CJ drafts, and CJ order details were reconciled when available."
        : "No TikTok orders were available from webhook storage or order search during this cycle.",
      observedOrders: uniqueOrders,
      createdDrafts,
      reconciledOrders,
    };
  }
}