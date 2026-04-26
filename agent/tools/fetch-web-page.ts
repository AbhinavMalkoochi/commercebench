import { load } from "cheerio";

import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  FetchWebPageInput,
  FetchWebPageOutput,
} from "@/agent/core/tools";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export async function fetch_web_page(
  input: FetchWebPageInput,
  context: AgentToolExecutionContext,
): Promise<FetchWebPageOutput> {
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(input.url, {
    headers: {
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const $ = load(html);
  const title = normalizeWhitespace($("title").first().text()) || undefined;
  const text = normalizeWhitespace($("body").text()).slice(0, input.maxCharacters ?? 5000);

  return {
    url: input.url,
    fetchedAt: context.now.toISOString(),
    statusCode: response.status,
    title,
    text,
  };
}

export const fetchWebPageTool: AgentToolDefinition<
  "fetch_web_page",
  FetchWebPageInput,
  FetchWebPageOutput
> = {
  name: "fetch_web_page",
  description: "Fetch a web page and return a normalized title and body text excerpt.",
  stage: "research",
  risk: "low",
  requiresApproval: false,
  execute: fetch_web_page,
};