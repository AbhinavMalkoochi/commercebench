import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { AgentCycleRecord, StoredAgentState } from "@/agent/core/types";

const LIVE_STATE_ROOT = path.join(process.cwd(), ".agent-state", "live");

interface TraceEvent {
  timestamp: string;
  type: string;
  payload: Record<string, unknown>;
}

interface TraceSummary {
  id: string;
  metadata: Record<string, unknown>;
  recentEvents: TraceEvent[];
}

async function readJsonFile<T>(filePath: string): Promise<T | undefined> {
  try {
    const contents = await readFile(filePath, "utf8");
    return JSON.parse(contents) as T;
  } catch {
    return undefined;
  }
}

async function readRecentCycleRecords(limit: number): Promise<AgentCycleRecord[]> {
  const cyclesDirectory = path.join(LIVE_STATE_ROOT, "cycles");

  try {
    const filenames = (await readdir(cyclesDirectory)).sort().reverse().slice(0, limit);
    const records = await Promise.all(
      filenames.map((filename) => readJsonFile<AgentCycleRecord>(path.join(cyclesDirectory, filename))),
    );

    return records.filter((record): record is AgentCycleRecord => Boolean(record));
  } catch {
    return [];
  }
}

async function readRecentTraces(limit: number): Promise<TraceSummary[]> {
  const tracesDirectory = path.join(LIVE_STATE_ROOT, "traces");

  try {
    const traceDirectories = (await readdir(tracesDirectory)).sort().reverse().slice(0, limit);
    const traces = await Promise.all(
      traceDirectories.map(async (traceId) => {
        const traceRoot = path.join(tracesDirectory, traceId);
        const metadata = await readJsonFile<Record<string, unknown>>(path.join(traceRoot, "metadata.json"));
        let recentEvents: TraceEvent[] = [];

        try {
          const eventsContents = await readFile(path.join(traceRoot, "events.ndjson"), "utf8");
          recentEvents = eventsContents
            .trim()
            .split("\n")
            .filter(Boolean)
            .slice(-10)
            .map((line) => JSON.parse(line) as TraceEvent);
        } catch {
          recentEvents = [];
        }

        return {
          id: traceId,
          metadata: metadata ?? {},
          recentEvents,
        } satisfies TraceSummary;
      }),
    );

    return traces;
  } catch {
    return [];
  }
}

function summarizeEnvironment() {
  return {
    openAi: Boolean(process.env.OPENAI_API_KEY),
    exa: Boolean(process.env.EXA_API_KEY),
    cj: Boolean(process.env.CJ_API_KEY),
    tikTokAppKey: Boolean(process.env.TIKTOK_APP_KEY),
    tikTokAppSecret: Boolean(process.env.TIKTOK_APP_SECRET),
    tikTokShopCipher: Boolean(process.env.TIKTOK_SHOP_CIPHER),
    remoteShellMode: process.env.AGENT_REMOTE_SHELL_MODE ?? "ssh",
    remoteShellHost: process.env.AGENT_REMOTE_SHELL_HOST ?? null,
    remoteShellUser: process.env.AGENT_REMOTE_SHELL_USER ?? null,
    remoteShellPort: process.env.AGENT_REMOTE_SSH_PORT ?? null,
    remoteShellIdentityFile: process.env.AGENT_REMOTE_SSH_IDENTITY_FILE ?? null,
  };
}

export async function getDashboardData() {
  const [state, cycles, traces] = await Promise.all([
    readJsonFile<StoredAgentState>(path.join(LIVE_STATE_ROOT, "state.json")),
    readRecentCycleRecords(6),
    readRecentTraces(4),
  ]);

  return {
    state: state ?? {
      currentState: "idle",
      cycleCount: 0,
      lastHeartbeat: null,
    },
    cycles,
    traces,
    environment: summarizeEnvironment(),
    hosting: {
      dashboardCommand: "npm run dev",
      daemonCommand: "npm run agent:daemon",
      containerStack: "docker compose up --build",
      sharedStatePath: "/app/.agent-state",
    },
  };
}