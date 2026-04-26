import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { AgentLoop } from "@/agent/core/agent-loop";
import { HeuristicReasoner } from "@/agent/core/reasoner";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
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
  assert.equal(record.productCreation?.plan.status, "draft_ready");
  assert.equal(record.productCreation?.plan.draft?.fulfillmentProvider, "cj_dropshipping");
  assert.equal(record.listingDraft?.status, "skipped");
  assert.ok(record.result.candidates.length >= 3, "Expected at least three ranked candidates.");
  assert.ok(
    record.result.queries.length >= 8,
    "Expected the planner to schedule at least eight queries.",
  );

  console.log("Smoke test passed.");
  console.log(`Selected candidate: ${selected.label}`);
  console.log(`Reasoning: ${record.result.reasoning}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});