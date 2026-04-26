import assert from "node:assert/strict";

import { buildListingDraft } from "@/agent/core/listing-draft-builder";
import { planProductCreation } from "@/agent/core/product-creation-kernel";
import { CandidatePortfolioEntry, PrintfulDraftExecutionResult, ResearchSignal } from "@/agent/core/types";

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
    priceBand: {
      currency: "USD",
      min: input.min,
      max: input.max,
    },
    detectedAt: new Date().toISOString(),
  };
}

function createCandidate(): CandidatePortfolioEntry {
  return {
    key: "graphic-tshirts",
    label: "Graphic T-Shirts",
    tags: ["apparel", "graphictee", "streetwear"],
    evidence: [createSignal({ label: "Graphic T-Shirts", tags: ["apparel", "graphictee", "streetwear"], min: 24, max: 32 })],
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
  assert.ok(plan.draft);

  const execution: PrintfulDraftExecutionResult = {
    status: "ready",
    reasoning: "fixture execution",
    selection: {
      productId: 71,
      productName: "Unisex Staple T-Shirt",
      variantId: 4011,
      variantName: "Black / M",
      unitPrice: 12.95,
      currency: "USD",
      productSourceUrl: "https://api.printful.com/products",
      pricingSourceUrl: "https://api.printful.com/v2/catalog-variants/4011/prices",
    },
    mockup: {
      taskId: 597350033,
      status: "completed",
      sourceUrl: "https://api.printful.com/v2/mockup-tasks?id=597350033",
      assets: [
        {
          catalogVariantId: 4011,
          placement: "front",
          displayName: "Front Print",
          technique: "dtg",
          styleId: 1,
          mockupUrl: "https://example.com/mockup.png",
        },
      ],
      failureReasons: [],
    },
    storeProduct: {
      productId: 7001,
      externalProductId: "commercebench-graphic-tshirts-4011",
      name: "Graphic T-Shirts launch draft",
      variantCount: 1,
      syncedCount: 1,
      sourceUrl: "https://api.printful.com/store/products",
      thumbnailUrl: "https://example.com/mockup.png",
    },
  };

  const listingDraft = buildListingDraft(plan.draft, execution);

  assert.equal(listingDraft.status, "ready");
  assert.equal(listingDraft.artifact?.title, "Graphic T-Shirts launch draft");
  assert.equal(listingDraft.artifact?.heroImageUrl, "https://example.com/mockup.png");
  assert.equal(listingDraft.artifact?.productHandle, "graphic-tshirts-7001");

  console.log("Listing draft smoke test passed.");
  console.log(`Listing handle: ${listingDraft.artifact?.productHandle}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});