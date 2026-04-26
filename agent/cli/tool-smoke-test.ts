import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { mkdtemp, readFile } from "node:fs/promises";

import { ToolExecutor } from "@/agent/core/tool-executor";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

const FETCH_FIXTURE_HTML = `
  <html>
    <head><title>Research Fixture</title></head>
    <body>
      <article>Current page text for a research fixture.</article>
    </body>
  </html>
`;

const FIXTURE_HTML = `
  <main>
    <article>
      <a href="https://www.tiktok.com/@kitchenfinds">@kitchenfinds</a>
      <span>Kitchen Finds</span>
      <span>128K followers</span>
      <span>kitchen</span>
    </article>
    <article>
      <a href="https://www.tiktok.com/@beautydropsdaily">@beautydropsdaily</a>
      <span>Beauty Drops Daily</span>
      <span>245K followers</span>
      <span>beauty</span>
    </article>
  </main>
`;

async function main(): Promise<void> {
  const registry = createDefaultToolRegistry();
  const traceRoot = await mkdtemp(path.join(os.tmpdir(), "commercebench-tools-"));
  const trace = new FileResearchTrace(traceRoot, new Date("2026-04-26T00:00:00.000Z"));
  await trace.initialize({
    command: "agent:tools:test",
  });

  const executor = new ToolExecutor(registry, trace);
  const fetchResult = await executor.execute(
    "fetch_web_page",
    {
      url: "https://example.com/research-fixture",
      maxCharacters: 200,
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
  );
      const affiliateResult = await executor.execute(
        "get_tiktok_affiliate",
    {
      query: "beauty creators with affiliate momentum",
      html: FIXTURE_HTML,
      pageUrl: "https://affiliate-us.tiktok.com/connection/creator",
      limit: 5,
    },
    {
      now: new Date("2026-04-26T00:00:00.000Z"),
    },
  );

  assert.equal(registry.listTools().length, 2);
  assert.equal(registry.listToolsForStage("research").length, 1);
  assert.equal(fetchResult.title, "Research Fixture");
  assert.equal(fetchResult.text.includes("Current page text"), true);
  assert.equal(affiliateResult.affiliates.length, 2);
  assert.equal(affiliateResult.affiliates[0]?.handle, "@kitchenfinds");
  assert.equal(affiliateResult.affiliates[1]?.category, "beauty");

  const toolInputPath = path.join(
    trace.traceDirectory,
    "tools",
    `${trace.queryBaseName("fetch_web_page-2026-04-26T00:00:00.000Z")}-input.json`,
  );
  const toolOutputPath = path.join(
    trace.traceDirectory,
    "tools",
    `${trace.queryBaseName("get_tiktok_affiliate-2026-04-26T00:00:00.000Z")}-output.json`,
  );

  const toolInput = JSON.parse(await readFile(toolInputPath, "utf8")) as { tool: string };
  const toolOutput = JSON.parse(await readFile(toolOutputPath, "utf8")) as { affiliates: Array<{ handle: string }> };

  assert.equal(toolInput.tool, "fetch_web_page");
  assert.equal(toolOutput.affiliates[0]?.handle, "@kitchenfinds");

  console.log("Tool smoke test passed.");
  console.log(`Registered tools: ${registry.listTools().map((entry) => entry.name).join(", ")}`);
  console.log(`Trace directory: ${trace.traceDirectory}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});