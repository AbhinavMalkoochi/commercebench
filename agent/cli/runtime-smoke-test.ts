import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { BudgetService } from "@/agent/core/budget-service";
import { ApprovalService } from "@/agent/core/approval-service";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { AgentTaskRunner } from "@/agent/core/task-runner";
import { AgentToolName } from "@/agent/core/tools";
import { FileApprovalStore } from "@/agent/infrastructure/file-approval-store";
import { FileBudgetLedger } from "@/agent/infrastructure/file-budget-ledger";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

const FETCH_FIXTURE_HTML = `
  <html>
    <head><title>Runtime Fixture</title></head>
    <body>
      <article>Runtime task runner fetched this fixture page.</article>
    </body>
  </html>
`;

async function main(): Promise<void> {
  const traceRoot = await mkdtemp(path.join(os.tmpdir(), "commercebench-runtime-"));
  const trace = new FileResearchTrace(traceRoot, new Date("2026-04-26T00:00:00.000Z"));
  await trace.initialize({ command: "agent:runtime:test" });
  const budget = new BudgetService(
    new FileBudgetLedger(path.join(traceRoot, "budget-log.json")),
    {
      totalBudgetUsd: 20,
      reserveUsd: 5,
    },
  );
  const approvals = new ApprovalService<AgentToolName>(
    new FileApprovalStore(path.join(traceRoot, "approvals.json")),
  );

  const runner = new AgentTaskRunner(
    createDefaultToolRegistry(),
    new DefaultToolPolicy(),
    trace,
    budget,
  );

  const completed = await runner.runPlan(
    {
      objective: "Fetch a research page through the task runner.",
      steps: [
        {
          id: "step-1",
          toolName: "fetch_web_page",
          estimatedCostUsd: 3,
          budgetAction: "research-fetch",
          input: {
            url: "https://example.com/runtime-fixture",
            maxCharacters: 200,
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async () =>
        new Response(FETCH_FIXTURE_HTML, {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        }),
    },
    {
      stage: "research",
    },
  );

  const blocked = await runner.runPlan(
    {
      objective: "Incorrectly try to run a marketing tool inside research.",
      steps: [
        {
          id: "step-2",
          toolName: "get_tiktok_affiliate",
          input: {
            query: "kitchen affiliates",
            html: "<div>@creator</div>",
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
    },
    {
      stage: "research",
    },
  );

  assert.equal(completed.status, "completed");
  assert.equal(completed.completedSteps.length, 1);
  assert.equal(blocked.status, "blocked");
  assert.equal(blocked.blockedStepId, "step-2");
  assert.equal(blocked.blockedReason?.includes("stage marketing"), true);

  const budgetBlocked = await runner.runPlan(
    {
      objective: "Try to overspend the runtime budget.",
      steps: [
        {
          id: "step-3",
          toolName: "fetch_web_page",
          estimatedCostUsd: 20,
          budgetAction: "overspend-fetch",
          input: {
            url: "https://example.com/runtime-fixture",
            maxCharacters: 200,
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async () =>
        new Response(FETCH_FIXTURE_HTML, {
          status: 200,
          headers: {
            "content-type": "text/html",
          },
        }),
    },
    {
      stage: "research",
    },
  );

  assert.equal(budgetBlocked.status, "blocked");
  assert.equal(budgetBlocked.blockedStepId, "step-3");
  assert.equal(budgetBlocked.blockedReason?.includes("Budget blocked step step-3"), true);

  const approvalBlocked = await runner.runPlan(
    {
      objective: "Attempt to create a mockup task without approval.",
      steps: [
        {
          id: "step-4",
          toolName: "create_printful_mockup_task",
          input: {
            storeId: "store-123",
            catalogProductId: 71,
            catalogVariantIds: [4011],
            mockupStyleIds: [100],
            placements: [
              {
                placement: "front",
                technique: "dtg",
                printAreaType: "simple",
                imageUrl: "https://example.com/design.png",
                position: { width: 10, height: 10, top: 0, left: 0 },
              },
            ],
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: [{ id: 1, status: "pending" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
    {
      stage: "product_creation",
    },
  );

  const approvalRequest = await approvals.requestApproval("create_printful_mockup_task");
  await approvals.decideRequest(approvalRequest.id, "approved");
  const approvalAllowed = await runner.runPlan(
    {
      objective: "Create a mockup task with approval.",
      steps: [
        {
          id: "step-5",
          toolName: "create_printful_mockup_task",
          input: {
            storeId: "store-123",
            catalogProductId: 71,
            catalogVariantIds: [4011],
            mockupStyleIds: [100],
            placements: [
              {
                placement: "front",
                technique: "dtg",
                printAreaType: "simple",
                imageUrl: "https://example.com/design.png",
                position: { width: 10, height: 10, top: 0, left: 0 },
              },
            ],
          },
        },
      ],
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
      fetchImpl: async () =>
        new Response(JSON.stringify({ data: [{ id: 777, status: "pending" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    },
    {
      stage: "product_creation",
      approvedToolNames: await approvals.listApprovedActions(),
    },
  );

  assert.equal(approvalBlocked.status, "blocked");
  assert.equal(approvalBlocked.blockedStepId, "step-4");
  assert.equal(approvalBlocked.blockedReason?.includes("requires explicit approval"), true);
  assert.equal(approvalAllowed.status, "completed");

  const savedResultPath = path.join(trace.traceDirectory, "runtime", "task-result.json");
  const savedResult = JSON.parse(await readFile(savedResultPath, "utf8")) as { status: string };
  assert.equal(savedResult.status, "completed");

  console.log("Runtime smoke test passed.");
  console.log(`Trace directory: ${trace.traceDirectory}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});