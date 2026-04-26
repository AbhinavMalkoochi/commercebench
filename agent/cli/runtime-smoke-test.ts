import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { AgentTaskRunner } from "@/agent/core/task-runner";
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

  const runner = new AgentTaskRunner(
    createDefaultToolRegistry(),
    new DefaultToolPolicy(),
    trace,
  );

  const completed = await runner.runPlan(
    {
      objective: "Fetch a research page through the task runner.",
      steps: [
        {
          id: "step-1",
          toolName: "fetch_web_page",
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

  const savedResultPath = path.join(trace.traceDirectory, "runtime", "task-result.json");
  const savedResult = JSON.parse(await readFile(savedResultPath, "utf8")) as { status: string };
  assert.equal(savedResult.status, "blocked");

  console.log("Runtime smoke test passed.");
  console.log(`Trace directory: ${trace.traceDirectory}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});