import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { AgentLoop } from "@/agent/core/agent-loop";
import { HeuristicReasoner } from "@/agent/core/reasoner";
import { QueryPlan } from "@/agent/core/types";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
import { mapParsedSignals } from "@/agent/infrastructure/search-signal-codec";
import {
  FixtureSearchProvider,
} from "@/agent/sources/fixtures";

async function main(): Promise<void> {
  const stateDirectory = path.join(process.cwd(), ".agent-state", "smoke-test");

  await rm(stateDirectory, { recursive: true, force: true });

  const loop = new AgentLoop(
    new FileStateStore(stateDirectory),
    {
      searchProvider: new FixtureSearchProvider(),
      reasoner: new HeuristicReasoner(),
    },
    {
      maxRetailPrice: 60,
      targetMarginFloor: 0.35,
    },
  );

  const record = await loop.runOnce(new Date("2026-04-26T12:00:00.000Z"));
  const selected = record.result.selectedCandidate;

  assert.equal(record.result.status, "passed");
  assert.ok(selected, "Expected a selected candidate.");
  assert.equal(selected.label, "Hydrocolloid Pimple Patches");
  assert.ok(
    selected.sourceIds.includes("cj_tiktok_products"),
    "Expected the winner to be corroborated by the CJ TikTok source.",
  );
  assert.ok(
    selected.sourceIds.length >= 3,
    "Expected the winner to be confirmed by at least three distinct sources.",
  );
  assert.equal(record.productCreation?.plan.status, "draft_ready");
  assert.equal(record.productCreation?.plan.draft?.fulfillmentProvider, "cj_dropshipping");
  assert.equal(record.listingDraft?.status, "skipped");
  assert.ok(record.result.candidates.length >= 3, "Expected at least three ranked candidates.");
  assert.ok(
    record.result.queries.length >= 8,
    "Expected the planner to schedule at least eight queries.",
  );

  const codecPlan: QueryPlan = {
    id: "query-tiktok-creative-center-products",
    sourceId: "tiktok_creative_center",
    query: "tiktok creative center top products April 2026",
    allowedDomains: ["ads.tiktok.com"],
    freshnessWindowDays: 21,
  };
  const codecSignals = mapParsedSignals(
    codecPlan,
    new Date("2026-04-26T12:00:00.000Z"),
    [
      {
        label: "T-shirts",
        summary: "Broad apparel category from TikTok merchandising surfaces.",
        sourceUrl: "https://ads.tiktok.com/business/creativecenter/top-products/pc/en",
        sourceTitle: "TikTok Creative Center Top Products",
        sourcePublishedAt: null,
        freshnessNote: "Current TikTok commerce surface for April 2026.",
        tags: ["apparel", "fashion", "category"],
        priceMin: null,
        priceMax: 20,
        freshness: 0.9,
        visualDemo: 0.8,
        creatorAppeal: 0.7,
        purchaseIntent: 0.7,
        priceFit: 0.9,
        saturationResistance: 0.35,
        seasonality: 0.75,
        confidence: 0.75,
      },
      {
        label: "Hydrocolloid Pimple Patches",
        summary: "Concrete product with clear TikTok demand.",
        sourceUrl: "https://ads.tiktok.com/business/creativecenter/top-products/pc/en",
        sourceTitle: "TikTok Creative Center Top Products",
        sourcePublishedAt: null,
        freshnessNote: "Current TikTok commerce surface for April 2026.",
        tags: ["skincare", "beauty"],
        priceMin: 8,
        priceMax: 18,
        freshness: 0.94,
        visualDemo: 0.95,
        creatorAppeal: 0.9,
        purchaseIntent: 0.88,
        priceFit: 0.96,
        saturationResistance: 0.56,
        seasonality: 0.82,
        confidence: 0.92,
      },
    ],
    0.95,
  );

  assert.equal(codecSignals.some((signal) => signal.label === "T-shirts"), false);
  assert.equal(codecSignals.some((signal) => signal.label === "Hydrocolloid Pimple Patches"), true);

  console.log("Smoke test passed.");
  console.log(`Selected candidate: ${selected.label}`);
  console.log(`Reasoning: ${record.result.reasoning}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});