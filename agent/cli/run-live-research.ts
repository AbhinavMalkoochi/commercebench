import OpenAI from "openai";
import Exa from "exa-js";

import { AgentLoop } from "@/agent/core/agent-loop";
import { SearchProvider } from "@/agent/core/types";
import { HeuristicReasoner, OpenAiReasoner } from "@/agent/core/reasoner";
import { CompositeSearchProvider } from "@/agent/infrastructure/composite-search-provider";
import { ExaSearchProvider } from "@/agent/infrastructure/exa-search-provider";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
import { loadRuntimeEnv } from "@/agent/infrastructure/load-runtime-env";
import { OpenAiSearchProvider } from "@/agent/infrastructure/openai-search-provider";

function logLiveTraceEvent(type: string, payload: Record<string, unknown>): void {
  switch (type) {
    case "trace_initialized":
      console.log(`[live] trace started (${String(payload.command ?? "agent:research:live")})`);
      return;
    case "research_loop_started":
      console.log(`[live] research loop started with ${String(payload.queryCount ?? "0")} queries`);
      return;
    case "query_started":
      console.log(`[live] starting ${String(payload.queryId ?? "query")} from ${String(payload.sourceId ?? "source")}`);
      return;
    case "query_completed":
      console.log(`[live] completed ${String(payload.queryId ?? "query")} with ${String(payload.signalCount ?? "0")} signals`);
      return;
    case "query_failed":
      console.log(`[live] failed ${String(payload.queryId ?? "query")} from ${String(payload.sourceId ?? "source")}`);
      return;
    case "research_scoring_completed":
      console.log(`[live] scored ${String(payload.candidateCount ?? "0")} candidates, ${String(payload.gatePassingCandidateCount ?? "0")} cleared the gate`);
      return;
    case "research_loop_passed":
      console.log(`[live] passed with candidate ${String(payload.selectedCandidateKey ?? "unknown")}`);
      return;
    case "research_loop_blocked":
      console.log(`[live] blocked: ${String(payload.reasoning ?? "unknown reason")}`);
      return;
    case "live_command_completed":
      console.log(`[live] command completed with status ${String(payload.status ?? "unknown")}`);
      return;
    default:
      return;
  }
}

async function main(): Promise<void> {
  loadRuntimeEnv();

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the live research runner.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
  const client = new OpenAI({ apiKey });
  const exaApiKey = process.env.EXA_API_KEY;
  const trace = new FileResearchTrace(
    `${process.cwd()}/.agent-state/live/traces`,
    new Date(),
    ({ type, payload }) => {
      logLiveTraceEvent(type, payload);
    },
  );

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
      orderSync: process.env.CJ_ORDER_SYNC_ACCESS_TOKEN
        ? {
            tikTok: process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_ORDER_SYNC_ACCESS_TOKEN && process.env.TIKTOK_SHOP_CIPHER
              ? {
                  appKey: process.env.TIKTOK_APP_KEY,
                  appSecret: process.env.TIKTOK_APP_SECRET,
                  accessToken: process.env.TIKTOK_ORDER_SYNC_ACCESS_TOKEN,
                  shopCipher: process.env.TIKTOK_SHOP_CIPHER,
                }
              : undefined,
            cj: {
              accessToken: process.env.CJ_ORDER_SYNC_ACCESS_TOKEN,
              defaultLogisticName: process.env.CJ_DEFAULT_LOGISTIC_NAME ?? "CJPacket Ordinary",
              fromCountryCode: process.env.CJ_FROM_COUNTRY_CODE ?? "CN",
              platform: "TikTokShop",
              storeName: process.env.CJ_STORE_NAME,
            },
          }
        : undefined,
      tikTokListing: process.env.TIKTOK_LISTING_ACCESS_TOKEN && process.env.TIKTOK_APP_KEY && process.env.TIKTOK_APP_SECRET && process.env.TIKTOK_SHOP_CIPHER
        ? {
            appKey: process.env.TIKTOK_APP_KEY,
            appSecret: process.env.TIKTOK_APP_SECRET,
            accessToken: process.env.TIKTOK_LISTING_ACCESS_TOKEN,
            shopCipher: process.env.TIKTOK_SHOP_CIPHER,
            currency: process.env.TIKTOK_LISTING_CURRENCY ?? "USD",
            defaultInventoryQuantity: Math.max(Number(process.env.TIKTOK_LISTING_DEFAULT_INVENTORY ?? "25"), 1),
            defaultWarehouseId: process.env.TIKTOK_LISTING_WAREHOUSE_ID,
            packageWeightValue: process.env.TIKTOK_LISTING_WEIGHT_VALUE ?? "0.3",
            packageWeightUnit: process.env.TIKTOK_LISTING_WEIGHT_UNIT ?? "KILOGRAM",
            packageLength: process.env.TIKTOK_LISTING_PACKAGE_LENGTH ?? "20",
            packageWidth: process.env.TIKTOK_LISTING_PACKAGE_WIDTH ?? "15",
            packageHeight: process.env.TIKTOK_LISTING_PACKAGE_HEIGHT ?? "5",
            packageDimensionUnit: process.env.TIKTOK_LISTING_PACKAGE_UNIT ?? "CENTIMETER",
            activateAfterCreate: process.env.TIKTOK_LISTING_ACTIVATE !== "0",
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
    listingExecutionStatus: record.listingExecution?.status,
    orderSyncStatus: record.orderSync?.status,
    lastResultPath: `${process.cwd()}/.agent-state/live`,
  });

  console.log(`Trace directory: ${trace.traceDirectory}`);
  console.log(JSON.stringify(record.result, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});