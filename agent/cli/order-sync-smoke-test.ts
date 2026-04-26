import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { OrderSync } from "@/agent/core/order-sync";
import { storeTikTokWebhook } from "@/app/tiktok-webhook-store";

const CJ_CREATE_ORDER_DRAFT_FIXTURE = {
  data: {
    orderId: "CJ-ORDER-001",
    orderNumber: "TT-ORDER-001",
    shipmentOrderId: "SHIP-001",
    actualPayment: "0.00",
    orderAmount: "8.75",
    cjPayUrl: "https://cjdropshipping.com/pay/order/CJ-ORDER-001",
    orderStatus: "CREATED",
    logisticsMiss: false,
    productInfoList: [
      {
        storeLineItemId: "tts-order-1-1",
        lineItemId: "cj-line-1",
        variantId: "cj-variant-1",
        quantity: 1,
        isGroup: false,
      },
    ],
    interceptOrderReasons: [],
  },
};

const CJ_ORDER_LIST_FIXTURE = {
  data: {
    pageNum: 1,
    pageSize: 50,
    total: 0,
    list: [],
  },
};

const CJ_ORDER_DETAIL_FIXTURE = {
  data: {
    orderId: "CJ-ORDER-001",
    orderNumber: "TT-ORDER-001",
    shipmentOrderId: "SHIP-001",
    orderStatus: "UNPAID",
    shippingCountryCode: "US",
    shippingProvince: "California",
    shippingCity: "Los Angeles",
    shippingCustomerName: "Jane Doe",
    shippingAddress: "123 Sunset Blvd",
    shippingZip: "90001",
    actualPayment: "0.00",
    orderAmount: "8.75",
    logisticName: "CJPacket Ordinary",
    trackNumber: "TRACK-123",
    createDate: "2026-04-26 00:00:00",
    productList: [
      {
        lineItemId: "cj-line-1",
        variantId: "cj-variant-1",
        quantity: 1,
        sku: "CJ-HAIR-001",
        productName: "Heatless Hair Curler Set",
      },
    ],
  },
};

async function main(): Promise<void> {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "commercebench-order-sync-"));
  const previousCwd = process.cwd();
  process.chdir(tempRoot);

  try {
    await storeTikTokWebhook({
      type: 1,
      data: {
        order: {
          id: "tts-order-1",
          status: "AWAITING_SHIPMENT",
          buyer_email: "buyer@example.com",
          recipient_address: {
            region_code: "US",
            postal_code: "90001",
            phone_number: "5551112222",
            name: "Jane Doe",
            full_address: "123 Sunset Blvd",
          },
          line_items: [
            {
              seller_sku: "CJ-HAIR-001",
              sku_id: "cj-variant-1",
              product_name: "Heatless Hair Curler Set",
              quantity: 1,
              sale_price: "14.99",
            },
          ],
        },
        order_id: "tts-order-1",
        order_status: "AWAITING_SHIPMENT",
      },
    });

    const fetchImpl: typeof fetch = async (input) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url.includes("/shopping/order/list")) {
        return new Response(JSON.stringify(CJ_ORDER_LIST_FIXTURE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/shopping/order/createOrderV2")) {
        return new Response(JSON.stringify(CJ_CREATE_ORDER_DRAFT_FIXTURE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      if (url.includes("/shopping/order/getOrderDetail")) {
        return new Response(JSON.stringify(CJ_ORDER_DETAIL_FIXTURE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      throw new Error(`Unexpected order sync fetch URL: ${url}`);
    };

    const result = await new OrderSync().run({
      config: {
        cj: {
          accessToken: "cj-access-token",
          defaultLogisticName: "CJPacket Ordinary",
          fromCountryCode: "CN",
          platform: "TikTokShop",
        },
      },
      toolContext: {
        now: new Date("2026-04-26T00:00:00.000Z"),
        fetchImpl,
      },
    });

    assert.equal(result.status, "ready");
    assert.equal(result.observedOrders[0]?.orderId, "tts-order-1");
    assert.equal(result.createdDrafts[0]?.cjOrderId, "CJ-ORDER-001");
    assert.equal(result.reconciledOrders[0]?.cjTrackingNumber, "TRACK-123");

    console.log("Order sync smoke test passed.");
  } finally {
    process.chdir(previousCwd);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});