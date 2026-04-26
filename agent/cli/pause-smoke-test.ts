import assert from "node:assert/strict";
import { rm } from "node:fs/promises";
import path from "node:path";

import { AgentLoop } from "@/agent/core/agent-loop";
import { ResearchDecision, ResearchReasoner, StoredAgentState } from "@/agent/core/types";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
import { FixtureSearchProvider } from "@/agent/sources/fixtures";

class FailingReasoner implements ResearchReasoner {
  async decide(): Promise<ResearchDecision> {
    throw new Error("Intentional reasoner failure for pause smoke test.");
  }
}

async function main(): Promise<void> {
  const stateDirectory = path.join(process.cwd(), ".agent-state", "pause-smoke-test");
  await rm(stateDirectory, { recursive: true, force: true });

  const store = new FileStateStore(stateDirectory);
  const loop = new AgentLoop(
    store,
    {
      searchProvider: new FixtureSearchProvider(),
      reasoner: new FailingReasoner(),
    },
    undefined,
    {
      maxConsecutiveRuntimeFailures: 2,
      pauseDurationMinutes: 15,
    },
  );

  await assert.rejects(
    loop.runOnce(new Date("2026-04-26T12:00:00.000Z")),
    /Intentional reasoner failure/,
  );

  await assert.rejects(
    loop.runOnce(new Date("2026-04-26T12:05:00.000Z")),
    /Intentional reasoner failure/,
  );

  const pausedState = await store.readState() as StoredAgentState;
  assert.equal(pausedState.currentState, "paused");
  assert.equal(pausedState.consecutiveRuntimeFailures, 2);
  assert.equal(typeof pausedState.pausedUntil, "string");

  await assert.rejects(
    loop.runOnce(new Date("2026-04-26T12:10:00.000Z")),
    /Agent loop is paused until/,
  );

  console.log("Pause smoke test passed.");
  console.log(`Paused until: ${pausedState.pausedUntil}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});