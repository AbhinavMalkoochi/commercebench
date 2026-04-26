import assert from "node:assert/strict";

import { CjDraftExecutor } from "@/agent/core/cj-draft-executor";
import { planProductCreation } from "@/agent/core/product-creation-kernel";
import { CandidatePortfolioEntry, ResearchSignal } from "@/agent/core/types";

const CJ_ACCESS_TOKEN_FIXTURE = {
  data: {
    openId: 123456789,
    accessToken: "cj-access-token",
    accessTokenExpiryDate: "2026-05-11T09:16:33+08:00",
    refreshToken: "cj-refresh-token",
    refreshTokenExpiryDate: "2026-10-23T09:16:33+08:00",
  },
};

const CJ_PRODUCTS_FIXTURE = {
  products: [
    {
      product_id: "cj-123",
      name: "Heatless Hair Curler Set",
      sku: "CJ-HAIR-001",
      price: 6.5,
    },
  ],
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
    key: "heatless-hair-curlers",
    label: "Heatless Hair Curlers",
    tags: ["beauty", "hair", "personalcare", "heatless"],
    evidence: [createSignal({ label: "Heatless Hair Curlers", tags: ["beauty", "hair", "personalcare", "heatless"], min: 5, max: 14 })],
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
      reasons: ["fresh demand signal", "easy to demo visually"],
    },
  };
}

async function main(): Promise<void> {
  const plan = planProductCreation({
    candidate: createCandidate(),
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
    preferredProvider: "cj_dropshipping",
  });

  assert.equal(plan.status, "draft_ready");
  assert.equal(plan.draft?.blueprint.provider, "cj_dropshipping");

  const executor = new CjDraftExecutor();
  const result = await executor.executeDraft(plan.draft!, {
    apiKey: "CJUSER@api@test-key",
    toolContext: {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async (input) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url.includes("/authentication/getAccessToken")) {
          return new Response(JSON.stringify(CJ_ACCESS_TOKEN_FIXTURE), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }

        return new Response(JSON.stringify(CJ_PRODUCTS_FIXTURE), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      },
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(result.selection?.productId, "cj-123");
  assert.equal(result.authentication?.openId, 123456789);
  assert.equal(result.authentication?.accessTokenExpiryDate, "2026-05-11T09:16:33+08:00");

  console.log("CJ draft executor smoke test passed.");
  console.log(`Selected product: ${result.selection?.name}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});