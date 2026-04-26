import assert from "node:assert/strict";

import { PrintfulDraftExecutor } from "@/agent/core/printful-draft-executor";
import { planProductCreation } from "@/agent/core/product-creation-kernel";
import { CandidatePortfolioEntry, ResearchSignal } from "@/agent/core/types";

const PRINTFUL_PRODUCTS_FIXTURE = {
  result: [
    {
      id: 71,
      name: "Unisex Staple T-Shirt",
      description: "A classic tee.",
      category_id: 24,
      variants: [
        {
          id: 4011,
          name: "Black / M",
          price: 12.95,
        },
      ],
    },
  ],
};

const PRINTFUL_PRICES_FIXTURE = {
  data: {
    variant_id: 4011,
    price: 12.95,
    currency: "USD",
  },
};

const PRINTFUL_MOCKUP_CREATE_FIXTURE = {
  data: [
    {
      id: 597350033,
      status: "pending",
    },
  ],
};

const PRINTFUL_MOCKUP_GET_FIXTURE = {
  id: 597350033,
  status: "completed",
  catalog_variant_mockups: [
    {
      catalog_variant_id: 4011,
      mockups: [
        {
          placement: "front",
          display_name: "Front Print",
          technique: "dtg",
          style_id: 1,
          mockup_url: "https://example.com/mockup.png",
        },
      ],
    },
  ],
  failure_reasons: [],
};

const PRINTFUL_STORE_PRODUCT_FIXTURE = {
  result: {
    id: 7001,
    external_id: "commercebench-graphic-tshirts-4011",
    name: "Graphic T-Shirts launch draft",
    variants: 1,
    synced: 1,
    thumbnail_url: "https://example.com/mockup.png",
  },
};

function createSignal(input: {
  label: string;
  tags: string[];
  min?: number;
  max?: number;
}): ResearchSignal {
  return {
    id: `${input.label}-signal`,
    kind: "candidate",
    sourceId: "tiktok_creative_center",
    queryId: "fixture-query",
    query: "fixture query",
    sourceMode: "search_backed",
    sourceUrl: "https://example.com",
    label: input.label,
    summary: `${input.label} fixture signal`,
    tags: input.tags,
    metrics: {
      freshness: 0.9,
      visualDemo: 0.8,
      creatorAppeal: 0.75,
      purchaseIntent: 0.7,
      priceFit: 0.8,
      saturationResistance: 0.65,
      seasonality: 0.55,
      sourceAuthority: 0.95,
    },
    confidence: 0.82,
    priceBand:
      typeof input.min === "number" || typeof input.max === "number"
        ? {
            currency: "USD",
            min: input.min,
            max: input.max,
          }
        : undefined,
    detectedAt: new Date().toISOString(),
  };
}

function createCandidate(): CandidatePortfolioEntry {
  return {
    key: "graphic-tshirts",
    label: "Graphic T-Shirts",
    tags: ["apparel", "graphictee", "streetwear"],
    evidence: [
      createSignal({
        label: "Graphic T-Shirts",
        tags: ["apparel", "graphictee", "streetwear"],
        min: 24,
        max: 32,
      }),
    ],
    sourceIds: ["tiktok_creative_center"],
    score: {
      total: 0.72,
      freshness: 0.9,
      signalCoverage: 0.7,
      visualDemo: 0.8,
      creatorAppeal: 0.75,
      purchaseIntent: 0.7,
      priceFit: 0.8,
      saturationResistance: 0.65,
      seasonality: 0.55,
      confidenceMultiplier: 0.9,
      gatePassed: true,
      gateReasons: [],
      reasons: ["easy to demo visually", "strong creator appeal"],
    },
  };
}

async function main(): Promise<void> {
  const plan = planProductCreation({
    candidate: createCandidate(),
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  });

  assert.equal(plan.status, "draft_ready");
  assert.equal(plan.draft?.blueprint.provider, "printful");

  const executor = new PrintfulDraftExecutor();
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/v2/mockup-tasks") && url.includes("id=")) {
      return new Response(JSON.stringify(PRINTFUL_MOCKUP_GET_FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/v2/mockup-tasks")) {
      return new Response(JSON.stringify(PRINTFUL_MOCKUP_CREATE_FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/store/products")) {
      return new Response(JSON.stringify(PRINTFUL_STORE_PRODUCT_FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/prices")) {
      return new Response(JSON.stringify(PRINTFUL_PRICES_FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    if (url.includes("/products")) {
      return new Response(JSON.stringify(PRINTFUL_PRODUCTS_FIXTURE), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };

  const result = await executor.executeDraft(plan.draft!, {
    storeId: "store-123",
    mockupStyleIds: [100],
    artworkUrl: "https://example.com/design.png",
    approvedToolNames: [
      "create_printful_mockup_task",
      "get_printful_mockup_task",
      "create_printful_store_product",
    ],
    pollTask: true,
    createStoreProduct: true,
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl,
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.selection?.productId, 71);
  assert.equal(result.mockup?.taskId, 597350033);
  assert.equal(result.mockup?.assets[0]?.mockupUrl, "https://example.com/mockup.png");
  assert.equal(result.storeProduct?.productId, 7001);

  console.log("Printful draft executor smoke test passed.");
  console.log(`Selection: ${result.selection?.productName} / ${result.selection?.variantName}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});