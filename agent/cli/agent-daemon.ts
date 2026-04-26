import OpenAI from "openai";
import Exa from "exa-js";

import { AgentLoop } from "@/agent/core/agent-loop";
import { SearchProvider } from "@/agent/core/types";
import { HeuristicReasoner, OpenAiReasoner } from "@/agent/core/reasoner";
import { CompositeSearchProvider } from "@/agent/infrastructure/composite-search-provider";
import { ExaSearchProvider } from "@/agent/infrastructure/exa-search-provider";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
import { OpenAiSearchProvider } from "@/agent/infrastructure/openai-search-provider";

async function createLoop(now: Date) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the hosted agent daemon.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
  const client = new OpenAI({ apiKey });
  const exaApiKey = process.env.EXA_API_KEY;
  const trace = new FileResearchTrace(`${process.cwd()}/.agent-state/live/traces`, now);

  await trace.initialize({
    command: "agent:daemon",
    model,
    exaEnabled: Boolean(exaApiKey),
    reasoner: process.env.OPENAI_DISABLE_REASONER === "1" ? "heuristic" : "openai",
    cjExecutionEnabled: Boolean(process.env.CJ_API_KEY),
    remoteShellEnabled: Boolean(process.env.AGENT_REMOTE_SHELL_HOST || process.env.AGENT_REMOTE_SHELL_MODE === "local"),
  });

  const searchProviders: SearchProvider[] = [new OpenAiSearchProvider(client, model, trace)];

  if (exaApiKey) {
    searchProviders.push(new ExaSearchProvider(new Exa(exaApiKey), client, model, trace));
  }

  return {
    loop: new AgentLoop(
      new FileStateStore(`${process.cwd()}/.agent-state/live`),
      {
        searchProvider: new CompositeSearchProvider(searchProviders),
        reasoner: process.env.OPENAI_DISABLE_REASONER === "1"
          ? new HeuristicReasoner()
          : new OpenAiReasoner(client, model, trace),
        trace,
      },
      {
        maxRetailPrice: 60,
        targetMarginFloor: 0.35,
        preferredProvider: "cj_dropshipping",
        cjExecution: process.env.CJ_API_KEY
          ? {
              apiKey: process.env.CJ_API_KEY,
            }
          : undefined,
      },
    ),
    trace,
  };
}

async function runDaemon(): Promise<void> {
  const intervalMs = Math.max(Number(process.env.AGENT_LOOP_INTERVAL_MS ?? "900000"), 60_000);

  while (true) {
    const now = new Date();
    const { loop, trace } = await createLoop(now);

    try {
      const record = await loop.runOnce(now);
      await trace.recordEvent("daemon_cycle_completed", {
        status: record.result.status,
        selectedCandidate: record.result.selectedCandidate?.key,
        productCreationStatus: record.productCreation?.plan.status,
        listingDraftStatus: record.listingDraft?.status,
      });
      console.log(`[agent-daemon] completed cycle ${record.cycleId} with status ${record.result.status}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown daemon error";
      await trace.recordEvent("daemon_cycle_failed", { message });
      console.error(`[agent-daemon] ${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

void runDaemon().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});