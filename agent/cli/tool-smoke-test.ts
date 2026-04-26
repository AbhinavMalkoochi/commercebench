import assert from "node:assert/strict";

import { createDefaultToolRegistry } from "@/agent/core/tool-registry";

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
  const fetchTool = registry.getTool("fetch_web_page");
  const fetchResult = await fetchTool.execute(
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

  const tool = registry.getTool("get_tiktok_affiliate");
  const affiliateResult = await tool.execute(
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

  console.log("Tool smoke test passed.");
  console.log(`Registered tools: ${registry.listTools().map((entry) => entry.name).join(", ")}`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});