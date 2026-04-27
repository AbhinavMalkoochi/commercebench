import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { AgentCycleRecord } from "@/agent/core/types";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";

async function main(): Promise<void> {
  const stateRoot = await mkdtemp(path.join(os.tmpdir(), "commercebench-product-mapping-"));
  const store = new FileStateStore(stateRoot);

  const record: AgentCycleRecord = {
    cycleId: "cycle-1",
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:01:00.000Z",
    result: {
      status: "passed",
      startedAt: "2026-04-26T00:00:00.000Z",
      completedAt: "2026-04-26T00:01:00.000Z",
      queries: [],
      signals: [],
      candidates: [],
      selectedCandidate: {
        key: "heatless-curlers",
        label: "Heatless Curlers",
        tags: ["beauty", "hair"],
        evidence: [],
        sourceIds: [],
        score: {
          total: 0.8,
          freshness: 0.8,
          signalCoverage: 0.5,
          visualDemo: 0.9,
          creatorAppeal: 0.8,
          purchaseIntent: 0.8,
          priceFit: 0.9,
          saturationResistance: 0.6,
          seasonality: 0.7,
          confidenceMultiplier: 0.9,
          gatePassed: true,
          gateReasons: [],
          reasons: ["easy to demo visually"],
        },
      },
      backupCandidates: [],
      decision: {
        selectedCandidateKey: "heatless-curlers",
        backupCandidateKeys: [],
        reasoning: "Fixture decision",
      },
      reasoning: "Fixture result",
      sourceAudit: [],
    },
    productCreation: {
      plan: {
        status: "draft_ready",
        reasoning: "Fixture draft",
        draft: {
          candidateKey: "heatless-curlers",
          candidateLabel: "Heatless Curlers",
          fulfillmentProvider: "cj_dropshipping",
          headline: "Heatless Curlers",
          pricing: {
            currency: "USD",
            targetRetailPrice: 24.99,
            maxUnitCost: 8,
          },
          blueprint: {
            provider: "cj_dropshipping",
            sourcingQuery: "heatless curlers",
            searchKeywords: ["heatless curlers"],
            sampleOrderRecommended: false,
            requiresManualPaymentApproval: true,
          },
          approvalRequirements: [],
          notes: [],
        },
      },
      execution: {
        status: "ready",
        reasoning: "Fixture CJ execution",
        selection: {
          productId: "cj-123",
          name: "Heatless Curlers",
          sku: "CJ-HAIR-001",
          sourceUrl: "https://example.com/cj-123",
        },
        authentication: {
          sourceUrl: "https://example.com/auth",
          accessTokenExpiryDate: "2026-05-01T00:00:00.000Z",
          refreshTokenExpiryDate: "2026-10-01T00:00:00.000Z",
        },
      },
    },
    listingDraft: {
      status: "ready",
      reasoning: "Fixture listing draft",
      artifact: {
        title: "Heatless Curlers",
        subtitle: "Beauty accessory",
        description: "Heatless curlers for TikTok demos.",
        bullets: ["No heat damage"],
        tags: ["beauty"],
        productHandle: "heatless-curlers-cj-123",
        retailPrice: 24.99,
      },
    },
    listingExecution: {
      status: "ready",
      reasoning: "Fixture publish",
      productId: "tts-456",
      skuIds: ["tts-sku-1"],
    },
  };

  await store.appendCycle(record);
  const mappings = await store.readProductMappings();

  assert.equal(mappings.length, 1);
  assert.equal(mappings[0]?.mappingKey, "heatless-curlers-cj-123");
  assert.equal(mappings[0]?.candidateKey, "heatless-curlers");
  assert.equal(mappings[0]?.cjProductId, "cj-123");
  assert.equal(mappings[0]?.cjSku, "CJ-HAIR-001");
  assert.equal(mappings[0]?.tikTokProductId, "tts-456");

  console.log("Product mapping smoke test passed.");
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});