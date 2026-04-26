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

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the live research runner.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
  const client = new OpenAI({ apiKey });
  const exaApiKey = process.env.EXA_API_KEY;
  const trace = new FileResearchTrace(`${process.cwd()}/.agent-state/live/traces`, new Date());

  await trace.initialize({
    command: "agent:research:live",
    model,
    exaEnabled: Boolean(exaApiKey),
    reasoner: process.env.OPENAI_DISABLE_REASONER === "1" ? "heuristic" : "openai",
    cjExecutionEnabled: Boolean(process.env.CJ_API_KEY),
  });

  const searchProviders: SearchProvider[] = [new OpenAiSearchProvider(client, model, trace)];

  if (exaApiKey) {
    searchProviders.push(new ExaSearchProvider(new Exa(exaApiKey), client, model, trace));
  }

  const cjApiKey = process.env.CJ_API_KEY;

  const loop = new AgentLoop(
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
      cjExecution: cjApiKey
        ? {
            apiKey: cjApiKey,
          }
        : undefined,
    },
  );
  const record = await loop.runOnce(new Date());

  await trace.recordEvent("live_command_completed", {
    status: record.result.status,
    selectedCandidate: record.result.selectedCandidate?.key,
    productCreationStatus: record.productCreation?.plan.status,
    productExecutionStatus: record.productCreation?.execution?.status,
    listingDraftStatus: record.listingDraft?.status,
    lastResultPath: `${process.cwd()}/.agent-state/live`,
  });

  console.log(`Trace directory: ${trace.traceDirectory}`);
  console.log(JSON.stringify(record.result, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});