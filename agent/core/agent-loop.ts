import { randomUUID } from "node:crypto";

import { CjDraftExecutor } from "@/agent/core/cj-draft-executor";
import { buildListingDraft } from "@/agent/core/listing-draft-builder";
import { OrderSync, OrderSyncConfig } from "@/agent/core/order-sync";
import { PrintfulDraftExecutor } from "@/agent/core/printful-draft-executor";
import { planProductCreation } from "@/agent/core/product-creation-kernel";
import {
  AgentCycleRecord,
  AgentStateStore,
  FulfillmentProvider,
  StoredAgentState,
} from "@/agent/core/types";
import { ResearchLoopDependencies, runResearchLoop } from "@/agent/core/research-loop";

interface AgentLoopProductCreationConfig {
  maxRetailPrice: number;
  targetMarginFloor: number;
  preferredProvider?: FulfillmentProvider;
  cjExecution?: {
    apiKey: string;
    fetchImpl?: typeof fetch;
  };
  printfulExecution?: {
    storeId: string;
    mockupStyleIds: number[];
    artworkUrl: string;
    approvedToolNames?: Array<
      "create_printful_mockup_task" |
      "get_printful_mockup_task" |
      "create_printful_store_product"
    >;
    placement?: string;
    technique?: string;
    printAreaType?: string;
    orientation?: "vertical" | "horizontal";
    pollTask?: boolean;
    createStoreProduct?: boolean;
    fetchImpl?: typeof fetch;
  };
  orderSync?: OrderSyncConfig;
}

interface AgentLoopControlPlaneConfig {
  maxConsecutiveRuntimeFailures: number;
  pauseDurationMinutes: number;
}

interface AgentLoopListingConfig {
  enabled: boolean;
}

const DEFAULT_CONTROL_PLANE_CONFIG: AgentLoopControlPlaneConfig = {
  maxConsecutiveRuntimeFailures: 3,
  pauseDurationMinutes: 30,
};

function createInitialState(): StoredAgentState {
  return {
    currentState: "idle",
    cycleCount: 0,
    lastHeartbeat: null,
  };
}

export class AgentLoop {
  private readonly cjDraftExecutor: CjDraftExecutor;
  private readonly printfulDraftExecutor: PrintfulDraftExecutor;
  private readonly orderSync: OrderSync;

  constructor(
    private readonly store: AgentStateStore,
    private readonly research: ResearchLoopDependencies,
    private readonly productCreation?: AgentLoopProductCreationConfig,
    private readonly controlPlane: AgentLoopControlPlaneConfig = DEFAULT_CONTROL_PLANE_CONFIG,
    private readonly listing: AgentLoopListingConfig = { enabled: true },
  ) {
    this.cjDraftExecutor = new CjDraftExecutor(research.trace);
    this.printfulDraftExecutor = new PrintfulDraftExecutor(research.trace);
    this.orderSync = new OrderSync();
  }

  async runOnce(now = new Date()): Promise<AgentCycleRecord> {
    const existingState = await this.store.readState().catch(() => createInitialState());

    if (existingState.pausedUntil && new Date(existingState.pausedUntil).getTime() > now.getTime()) {
      const message = `Agent loop is paused until ${existingState.pausedUntil} after repeated runtime failures.`;

      await this.store.writeState({
        ...existingState,
        currentState: "paused",
        lastHeartbeat: now.toISOString(),
        lastError: message,
      });

      throw new Error(message);
    }

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
      let productCreation: AgentCycleRecord["productCreation"] | undefined;
      let listingDraft: AgentCycleRecord["listingDraft"] | undefined;
      let orderSync: AgentCycleRecord["orderSync"] | undefined;
      let completedAt = result.completedAt;

      if (result.status === "passed" && result.selectedCandidate && this.productCreation) {
        await this.store.writeState({
          ...existingState,
          currentState: "running_product_creation",
          cycleCount,
          lastHeartbeat: completedAt,
          lastError: undefined,
        });

        const plan = planProductCreation({
          candidate: result.selectedCandidate,
          maxRetailPrice: this.productCreation.maxRetailPrice,
          targetMarginFloor: this.productCreation.targetMarginFloor,
          preferredProvider: this.productCreation.preferredProvider,
        });
        productCreation = { plan };

        if (
          plan.status === "draft_ready" &&
          plan.draft?.blueprint.provider === "cj_dropshipping" &&
          this.productCreation.cjExecution
        ) {
          const execution = await this.cjDraftExecutor.executeDraft(plan.draft, {
            apiKey: this.productCreation.cjExecution.apiKey,
            toolContext: {
              now,
              fetchImpl: this.productCreation.cjExecution.fetchImpl,
            },
          });

          productCreation.execution = execution;
        }

        if (
          plan.status === "draft_ready" &&
          plan.draft?.blueprint.provider === "printful" &&
          this.productCreation.printfulExecution
        ) {
          const execution = await this.printfulDraftExecutor.executeDraft(plan.draft, {
            storeId: this.productCreation.printfulExecution.storeId,
            mockupStyleIds: this.productCreation.printfulExecution.mockupStyleIds,
            artworkUrl: this.productCreation.printfulExecution.artworkUrl,
            approvedToolNames: this.productCreation.printfulExecution.approvedToolNames,
            placement: this.productCreation.printfulExecution.placement,
            technique: this.productCreation.printfulExecution.technique,
            printAreaType: this.productCreation.printfulExecution.printAreaType,
            orientation: this.productCreation.printfulExecution.orientation,
            pollTask: this.productCreation.printfulExecution.pollTask,
            createStoreProduct: this.productCreation.printfulExecution.createStoreProduct,
            toolContext: {
              now,
              fetchImpl: this.productCreation.printfulExecution.fetchImpl,
            },
          });

          productCreation.execution = execution;
        }

        if (plan.status === "draft_ready" && this.listing.enabled) {
          listingDraft = buildListingDraft(plan.draft!, productCreation.execution);
        }

        completedAt = new Date().toISOString();
      }

      if (this.productCreation?.orderSync) {
        orderSync = await this.orderSync.run({
          config: this.productCreation.orderSync,
          toolContext: {
            now,
            fetchImpl: this.productCreation.cjExecution?.fetchImpl,
          },
        });
        completedAt = new Date().toISOString();
      }

      const record: AgentCycleRecord = {
        cycleId: randomUUID(),
        startedAt,
        completedAt,
        result,
        productCreation,
        listingDraft,
        orderSync,
      };
      const lastResultPath = await this.store.appendCycle(record);

      const currentState = result.status !== "passed"
        ? "blocked_low_signal"
        : !productCreation
          ? "research_complete"
          : productCreation.execution?.status === "blocked" || productCreation.plan.status === "blocked_manual_review"
            ? "blocked_manual_review"
            : "product_creation_complete";

      await this.store.writeState({
        currentState,
        cycleCount,
        lastHeartbeat: completedAt,
        lastResultPath,
        consecutiveRuntimeFailures: 0,
        pausedUntil: undefined,
        lastError: undefined,
      });

      return record;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const consecutiveRuntimeFailures = (existingState.consecutiveRuntimeFailures ?? 0) + 1;
      const shouldPause = consecutiveRuntimeFailures >= this.controlPlane.maxConsecutiveRuntimeFailures;
      const pausedUntil = shouldPause
        ? new Date(now.getTime() + this.controlPlane.pauseDurationMinutes * 60_000).toISOString()
        : undefined;

      await this.store.writeState({
        currentState: shouldPause ? "paused" : "error",
        cycleCount,
        lastHeartbeat: startedAt,
        lastError: message,
        consecutiveRuntimeFailures,
        pausedUntil,
      });

      throw error;
    }
  }
}