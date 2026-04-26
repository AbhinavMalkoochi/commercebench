import { randomUUID } from "node:crypto";

import {
  AgentCycleRecord,
  AgentStateStore,
  StoredAgentState,
} from "@/agent/core/types";
import { ResearchLoopDependencies, runResearchLoop } from "@/agent/core/research-loop";

function createInitialState(): StoredAgentState {
  return {
    currentState: "idle",
    cycleCount: 0,
    lastHeartbeat: null,
  };
}

export class AgentLoop {
  constructor(
    private readonly store: AgentStateStore,
    private readonly research: ResearchLoopDependencies,
  ) {}

  async runOnce(now = new Date()): Promise<AgentCycleRecord> {
    const existingState = await this.store.readState().catch(() => createInitialState());
    const cycleCount = existingState.cycleCount + 1;
    const startedAt = now.toISOString();

    await this.store.writeState({
      ...existingState,
      currentState: "running_research",
      cycleCount,
      lastHeartbeat: startedAt,
      lastError: undefined,
    });

    try {
      const result = await runResearchLoop(this.research, now);
      const record: AgentCycleRecord = {
        cycleId: randomUUID(),
        startedAt,
        completedAt: result.completedAt,
        result,
      };
      const lastResultPath = await this.store.appendCycle(record);

      await this.store.writeState({
        currentState:
          result.status === "passed" ? "research_complete" : "blocked_low_signal",
        cycleCount,
        lastHeartbeat: startedAt,
        lastResultPath,
      });

      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      await this.store.writeState({
        currentState: "error",
        cycleCount,
        lastHeartbeat: startedAt,
        lastError: message,
      });

      throw error;
    }
  }
}