import assert from "node:assert/strict";

import { PrintfulDraftInspector } from "@/agent/core/printful-draft-inspector";
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

  const printfulDraft = planProductCreation({
    candidate: printfulCandidate,
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  }).draft;
  const sourcedDraft = planProductCreation({
    candidate: sourcedCandidate,
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  }).draft;

  assert.ok(printfulDraft);
  assert.ok(sourcedDraft);

  const inspector = new PrintfulDraftInspector();
  const fetchImpl: typeof fetch = async (input) => {
    const url = typeof input === "string" ? input : input.toString();

    if (url.includes("/products")) {
      return new Response(
        JSON.stringify({
          result: [
            {
              id: 71,
              name: "Unisex Staple T-Shirt",
              category_id: 24,
              variants: [
                {
                  id: 4011,
                  name: "Black / M",
                },
              ],
            },
          ],
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    if (url.includes("/prices")) {
      return new Response(
        JSON.stringify({
          data: {
            variant_id: 4011,
            price: 12.95,
            currency: "USD",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    }

    throw new Error(`Unexpected inspection URL: ${url}`);
  };

  const ready = await inspector.inspectDraft(printfulDraft, {
    storeId: "store-123",
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl,
    },
  });
  const skipped = await inspector.inspectDraft(sourcedDraft, {
    storeId: "store-123",
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl,
    },
  });

  assert.equal(ready.status, "ready");
  assert.equal(ready.selection?.variantId, 4011);
  assert.equal(skipped.status, "skipped");

  console.log("Printful draft inspector smoke test passed.");
  console.log(`Selected variant: ${ready.selection?.variantName}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});