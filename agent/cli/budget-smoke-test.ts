import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { BudgetService } from "@/agent/core/budget-service";
import { FileBudgetLedger } from "@/agent/infrastructure/file-budget-ledger";

async function main(): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "commercebench-budget-"));
  const ledger = new FileBudgetLedger(path.join(directory, "budget-log.json"));
  const budget = new BudgetService(ledger, {
    totalBudgetUsd: 100,
    reserveUsd: 10,
  });

  const firstCheck = await budget.recordPlannedAction("printful-mockup", 15);
  const secondCheck = await budget.recordPlannedAction("supplier-order", 80);
  await budget.recordExecutedAction("printful-mockup", 15);

  const entries = await ledger.listEntries();

  assert.equal(firstCheck.allowed, true);
  assert.equal(secondCheck.allowed, false);
  assert.equal(entries.length, 3);
  assert.equal(entries[0]?.status, "planned");
  assert.equal(entries[1]?.status, "blocked");
  assert.equal(entries[2]?.status, "executed");

  console.log("Budget smoke test passed.");
  console.log(`Ledger path: ${path.join(directory, "budget-log.json")}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});