import assert from "node:assert/strict";

import { planProductCreation } from "@/agent/core/product-creation-kernel";
import { CandidatePortfolioEntry, ResearchSignal } from "@/agent/core/types";

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

function createCandidate(input: {
  key: string;
  label: string;
  tags: string[];
  reasons: string[];
  min?: number;
  max?: number;
}): CandidatePortfolioEntry {
  return {
    key: input.key,
    label: input.label,
    tags: input.tags,
    evidence: [createSignal(input)],
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
      reasons: input.reasons,
    },
  };
}

async function main(): Promise<void> {
  const printfulCandidate = createCandidate({
    key: "graphic-tshirts",
    label: "Graphic T-Shirts",
    tags: ["apparel", "graphictee", "streetwear"],
    reasons: ["easy to demo visually", "strong creator appeal"],
    min: 24,
    max: 32,
  });
  const sourcedCandidate = createCandidate({
    key: "heatless-hair-curlers",
    label: "Heatless Hair Curlers",
    tags: ["beauty", "hair", "personalcare", "heatless"],
    reasons: ["fresh demand signal", "easy to demo visually"],
    min: 5,
    max: 14,
  });

  const printfulResult = planProductCreation({
    candidate: printfulCandidate,
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  });
  const sourcedResult = planProductCreation({
    candidate: sourcedCandidate,
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  });

  assert.equal(printfulResult.status, "draft_ready");
  assert.equal(printfulResult.draft?.fulfillmentProvider, "printful");
  assert.equal(printfulResult.draft?.blueprint.provider, "printful");
  assert.equal(printfulResult.draft?.blueprint.productFamily, "tshirt");

  assert.equal(sourcedResult.status, "draft_ready");
  assert.equal(sourcedResult.draft?.fulfillmentProvider, "cj_dropshipping");
  assert.equal(sourcedResult.draft?.blueprint.provider, "cj_dropshipping");
  assert.equal(sourcedResult.draft?.blueprint.requiresManualPaymentApproval, true);

  console.log("Product creation smoke test passed.");
  console.log(`Printful draft: ${printfulResult.draft?.headline}`);
  console.log(`CJ draft: ${sourcedResult.draft?.headline}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});