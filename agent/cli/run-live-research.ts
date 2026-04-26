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

function parseNumericList(value: string | undefined): number[] {
  return (value ?? "")
    .split(",")
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry));
}

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
  });

  const searchProviders: SearchProvider[] = [new OpenAiSearchProvider(client, model, trace)];

  if (exaApiKey) {
    searchProviders.push(new ExaSearchProvider(new Exa(exaApiKey), client, model, trace));
  }

  const printfulStoreId = process.env.PRINTFUL_STORE_ID;
  const printfulArtworkUrl = process.env.PRINTFUL_ARTWORK_URL;
  const printfulMockupStyleIds = parseNumericList(process.env.PRINTFUL_MOCKUP_STYLE_IDS);
  const autoApproveMockups = process.env.PRINTFUL_AUTO_APPROVE_MOCKUPS === "1";
  const createProductDraft = process.env.PRINTFUL_CREATE_PRODUCT_DRAFT === "1";
  const autoApproveProductDraft = process.env.PRINTFUL_AUTO_APPROVE_PRODUCT_DRAFT === "1";

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
      printfulExecution:
        printfulStoreId && printfulArtworkUrl && printfulMockupStyleIds.length > 0
          ? {
              storeId: printfulStoreId,
              artworkUrl: printfulArtworkUrl,
              mockupStyleIds: printfulMockupStyleIds,
              approvedToolNames: [
                ...(autoApproveMockups ? ["create_printful_mockup_task", "get_printful_mockup_task"] as const : []),
                ...(autoApproveProductDraft ? ["create_printful_store_product"] as const : []),
              ],
              pollTask: true,
              createStoreProduct: createProductDraft,
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
    lastResultPath: `${process.cwd()}/.agent-state/live`,
  });

  console.log(`Trace directory: ${trace.traceDirectory}`);
  console.log(JSON.stringify(record.result, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});