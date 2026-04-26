import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentCycleRecord,
  AgentStateStore,
  StoredAgentState,
} from "@/agent/core/types";

const DEFAULT_STATE: StoredAgentState = {
  currentState: "idle",
  cycleCount: 0,
  lastHeartbeat: null,
};

export class FileStateStore implements AgentStateStore {
  private readonly stateFilePath: string;
  private readonly cyclesDirectoryPath: string;

  constructor(baseDirectoryPath: string) {
    this.stateFilePath = path.join(baseDirectoryPath, "state.json");
    this.cyclesDirectoryPath = path.join(baseDirectoryPath, "cycles");
  }

  async readState(): Promise<StoredAgentState> {
    try {
      const contents = await readFile(this.stateFilePath, "utf8");

      return JSON.parse(contents) as StoredAgentState;
    } catch {
      return DEFAULT_STATE;
    }
  }

  async writeState(state: StoredAgentState): Promise<void> {
    await mkdir(path.dirname(this.stateFilePath), { recursive: true });
    await writeFile(this.stateFilePath, JSON.stringify(state, null, 2));
  }

  async appendCycle(record: AgentCycleRecord): Promise<string> {
    await mkdir(this.cyclesDirectoryPath, { recursive: true });

    const filename = `${record.startedAt.replace(/[:.]/g, "-")}-${record.cycleId}.json`;
    const fullPath = path.join(this.cyclesDirectoryPath, filename);

    await writeFile(fullPath, JSON.stringify(record, null, 2));

    return fullPath;
  }
}