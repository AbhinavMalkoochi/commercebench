import assert from "node:assert/strict";

import { TikTokListingPublisher } from "@/agent/core/tiktok-listing-publisher";
import { ListingDraftResult, ProductExecutionResult } from "@/agent/core/types";

const listingDraft: ListingDraftResult = {
  status: "ready",
  reasoning: "Fixture listing draft",
  artifact: {
    title: "Heatless Hair Curler Set",
    subtitle: "Beauty draft",
    description: "Heatless curlers trending on TikTok.",
    bullets: ["No heat damage", "Impulse beauty accessory"],
    tags: ["beauty", "hair"],
    heroImageUrl: "https://example.com/product.jpg",
    productHandle: "heatless-curlers-cj-123",
    retailPrice: 19.99,
    compareAtPrice: 29.99,
  },
};

const productExecution: ProductExecutionResult = {
  status: "ready",
  reasoning: "Resolved CJ product",
  selection: {
    productId: "cj-123",
    name: "Heatless Hair Curler Set",
    sku: "CJ-HAIR-001",
    price: 6.5,
    imageUrl: "https://example.com/product.jpg",
    sourceUrl: "https://example.com/cj",
  },
  authentication: {
    sourceUrl: "https://example.com/auth",
    accessTokenExpiryDate: "2026-05-11T09:16:33+08:00",
    refreshTokenExpiryDate: "2026-10-23T09:16:33+08:00",
  },
};

async function main(): Promise<void> {
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url === "https://example.com/product.jpg") {
      return new Response("image-bytes", { status: 200 });
    }

    if (url.includes("/logistics/202309/warehouses")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: { warehouses: [{ id: "wh-1", is_default: true, name: "Main Warehouse", address: { region_code: "US", city: "Los Angeles" } }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/product/202309/categories/recommend")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: { leaf_category_id: "cat-1", categories: [{ id: "beauty", name: "Beauty", level: 1, is_leaf: false, permission_statuses: [] }, { id: "cat-1", name: "Hair Styling Tools", level: 2, is_leaf: true, permission_statuses: [] }] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/product/202309/images/upload")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: { uri: "img-uri-1", url: "https://cdn.example.com/img.jpg", width: 1200, height: 1200, use_case: "MAIN_IMAGE" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/product/202309/products") && !url.includes("activate")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: { product_id: "tts-prod-1", skus: [{ id: "tts-sku-1" }], warnings: [] } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("activate")) {
      return new Response(JSON.stringify({ code: 0, message: "success", data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected TikTok listing publish fetch URL: ${url}`);
  };

  const result = await new TikTokListingPublisher().publish({
    draft: listingDraft,
    productExecution,
    config: {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tt-access-token",
      shopCipher: "cipher-123",
      currency: "USD",
      defaultInventoryQuantity: 25,
      packageWeightValue: "0.3",
      packageWeightUnit: "KILOGRAM",
      packageLength: "20",
      packageWidth: "15",
      packageHeight: "5",
      packageDimensionUnit: "CENTIMETER",
      activateAfterCreate: true,
    },
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.productId, "tts-prod-1");
  assert.equal(result.warehouseId, "wh-1");
  assert.equal(result.categoryId, "cat-1");
  assert.equal(result.imageUris?.[0], "img-uri-1");

  const blockedResult = await new TikTokListingPublisher().publish({
    draft: {
      ...listingDraft,
      artifact: {
        ...listingDraft.artifact!,
        title: "Prescription acne treatment",
        description: "Prescription-strength treatment for acne.",
        tags: ["medical", "skincare"],
      },
    },
    productExecution,
    config: {
      appKey: "tt-app-key",
      appSecret: "tt-app-secret",
      accessToken: "tt-access-token",
      shopCipher: "cipher-123",
      currency: "USD",
      defaultInventoryQuantity: 25,
      packageWeightValue: "0.3",
      packageWeightUnit: "KILOGRAM",
      packageLength: "20",
      packageWidth: "15",
      packageHeight: "5",
      packageDimensionUnit: "CENTIMETER",
      activateAfterCreate: true,
    },
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl,
    },
  });

  assert.equal(blockedResult.status, "blocked");
  assert.equal(blockedResult.reasoning.includes("restricted product category"), true);

  console.log("TikTok listing publish smoke test passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});