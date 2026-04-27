import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  AgentCycleRecord,
  AgentStateStore,
  CjDraftInspectionSelection,
  ProductMappingRecord,
  StoredAgentState,
} from "@/agent/core/types";

const DEFAULT_STATE: StoredAgentState = {
  currentState: "idle",
  cycleCount: 0,
  lastHeartbeat: null,
};

function isCjSelection(selection: unknown): selection is CjDraftInspectionSelection {
  return Boolean(
    selection &&
    typeof selection === "object" &&
    "productId" in selection &&
    typeof (selection as { productId?: unknown }).productId === "string" &&
    "sourceUrl" in selection,
  );
}

export class FileStateStore implements AgentStateStore {
  private readonly stateFilePath: string;
  private readonly cyclesDirectoryPath: string;
  private readonly productMappingsFilePath: string;

  constructor(baseDirectoryPath: string) {
    this.stateFilePath = path.join(baseDirectoryPath, "state.json");
    this.cyclesDirectoryPath = path.join(baseDirectoryPath, "cycles");
    this.productMappingsFilePath = path.join(baseDirectoryPath, "product-mappings.json");
  }

  async readProductMappings(): Promise<ProductMappingRecord[]> {
    try {
      const contents = await readFile(this.productMappingsFilePath, "utf8");
      return JSON.parse(contents) as ProductMappingRecord[];
    } catch {
      return [];
    }
  }

  private buildProductMapping(record: AgentCycleRecord): ProductMappingRecord | undefined {
    const candidate = record.result.selectedCandidate;
    const listingHandle = record.listingDraft?.artifact?.productHandle;
    const cjSelection = isCjSelection(record.productCreation?.execution?.selection)
      ? record.productCreation?.execution?.selection
      : undefined;

    if (!candidate || !listingHandle || !cjSelection) {
      return undefined;
    }

    return {
      mappingKey: listingHandle,
      cycleId: record.cycleId,
      updatedAt: record.completedAt,
      candidateKey: candidate.key,
      candidateLabel: candidate.label,
      fulfillmentProvider: record.productCreation?.plan.draft?.fulfillmentProvider,
      listingHandle,
      cjProductId: cjSelection.productId,
      cjSku: cjSelection.sku,
      tikTokProductId: record.listingExecution?.productId,
      tikTokSkuIds: record.listingExecution?.skuIds ?? [],
      latestListingDraftStatus: record.listingDraft?.status,
      latestListingExecutionStatus: record.listingExecution?.status,
    };
  }

  private async upsertProductMapping(record: AgentCycleRecord): Promise<void> {
    const mapping = this.buildProductMapping(record);

    if (!mapping) {
      return;
    }

    const existingMappings = await this.readProductMappings();
    const nextMappings = existingMappings.filter((entry) => entry.mappingKey !== mapping.mappingKey);
    nextMappings.unshift(mapping);

    await mkdir(path.dirname(this.productMappingsFilePath), { recursive: true });
    await writeFile(this.productMappingsFilePath, JSON.stringify(nextMappings, null, 2));
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
    await this.upsertProductMapping(record);

    return fullPath;
  }
}