import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { planProductCreation } from "@/agent/core/product-creation-kernel";
import { AgentCycleRecord, StoredAgentState } from "@/agent/core/types";

async function readCycle(filePath: string): Promise<AgentCycleRecord> {
  return JSON.parse(await readFile(filePath, "utf8")) as AgentCycleRecord;
}

async function findLatestPassedCycle(baseDirectory: string, state: StoredAgentState): Promise<AgentCycleRecord> {
  const candidatePaths = new Set<string>();

  if (state.lastResultPath) {
    candidatePaths.add(state.lastResultPath);
  }

  const cyclesDirectory = path.join(baseDirectory, "cycles");
  const cycleFiles = (await readdir(cyclesDirectory)).sort().reverse();

  cycleFiles.forEach((filename) => {
    candidatePaths.add(path.join(cyclesDirectory, filename));
  });

  for (const filePath of candidatePaths) {
    const record = await readCycle(filePath);

    if (record.result.status === "passed" && record.result.selectedCandidate) {
      return record;
    }
  }

  throw new Error("No passed research cycle with a selected candidate was found.");
}

async function main(): Promise<void> {
  const stateDirectory = process.env.AGENT_STATE_DIR ?? path.join(process.cwd(), ".agent-state", "live");
  const statePath = path.join(stateDirectory, "state.json");
  const state = JSON.parse(await readFile(statePath, "utf8")) as StoredAgentState;

  const record = await findLatestPassedCycle(stateDirectory, state);
  const selectedCandidate = record.result.selectedCandidate;

  if (!selectedCandidate) {
    throw new Error("The latest research cycle does not contain a selected candidate.");
  }

  const creation = planProductCreation({
    candidate: selectedCandidate,
    maxRetailPrice: 60,
    targetMarginFloor: 0.35,
  });

  console.log(JSON.stringify(creation, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});