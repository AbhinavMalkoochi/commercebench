import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp } from "node:fs/promises";

import { ApprovalService } from "@/agent/core/approval-service";
import { FileApprovalStore } from "@/agent/infrastructure/file-approval-store";

async function main(): Promise<void> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "commercebench-approval-"));
  const service = new ApprovalService(new FileApprovalStore(path.join(directory, "approvals.json")));

  const request = await service.requestApproval("create_printful_mockup_task", {
    objective: "Generate draft mockups",
  });
  const decided = await service.decideRequest(request.id, "approved");
  const approvedActions = await service.listApprovedActions();

  assert.equal(request.status, "pending");
  assert.equal(decided.status, "approved");
  assert.equal(approvedActions.includes("create_printful_mockup_task"), true);

  console.log("Approval smoke test passed.");
  console.log(`Approval file: ${path.join(directory, "approvals.json")}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});