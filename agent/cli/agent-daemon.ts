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

async function createLoop(now: Date) {
  loadRuntimeEnv();

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
        listingExecutionStatus: record.listingExecution?.status,
        orderSyncStatus: record.orderSync?.status,
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