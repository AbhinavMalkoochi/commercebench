import path from "node:path";

import Exa from "exa-js";
import OpenAI from "openai";

import { QueryPlan, ResearchSignal, SearchProvider } from "@/agent/core/types";
import {
  buildSearchInstructions,
  buildSearchResponseFormat,
  mapParsedSignals,
} from "@/agent/infrastructure/search-signal-codec";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

function buildEvidencePrompt(plan: QueryPlan, now: Date, results: unknown[]): string {
  return [
    buildSearchInstructions(plan, now),
    "Use only the evidence below. Do not use your own web search for this extraction step.",
    JSON.stringify({ results }, null, 2),
  ].join("\n\n");
}

export class ExaSearchProvider implements SearchProvider {
  constructor(
    private readonly exa: Exa,
    private readonly extractorClient: OpenAI,
    private readonly model = "gpt-5.4",
    private readonly trace?: FileResearchTrace,
  ) {}

  async searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]> {
    const searchResponse = await this.exa.search(plan.query, {
      type: "auto",
      numResults: 6,
      useAutoprompt: false,
      includeDomains: plan.allowedDomains,
      contents: {
        text: { maxCharacters: 1400 },
        highlights: { maxCharacters: 600 },
        summary: true,
      },
    });

    const prompt = buildEvidencePrompt(plan, now, searchResponse.results);
    const baseName = this.trace?.queryBaseName(`${plan.id}-exa`);

    if (this.trace && baseName) {
      await Promise.all([
        this.trace.writeText(path.join("search", `${baseName}-prompt.txt`), prompt),
        this.trace.writeJson(path.join("search", `${baseName}-request.json`), {
          queryId: plan.id,
          sourceId: plan.sourceId,
          query: plan.query,
          allowedDomains: plan.allowedDomains,
          resultCount: searchResponse.results.length,
          model: this.model,
          provider: "exa",
        }),
        this.trace.recordEvent("search_started", {
          queryId: plan.id,
          sourceId: plan.sourceId,
          provider: "exa",
        }),
      ]);
    }

    const response = await this.extractorClient.responses.parse({
      model: this.model,
      input: prompt,
      text: {
        format: buildSearchResponseFormat("exa_search_signals"),
      },
    });

    const parsed = response.output_parsed;

    if (this.trace && baseName) {
      await Promise.all([
        this.trace.writeJson(path.join("search", `${baseName}-response.json`), {
          outputText: response.output_text,
          parsed,
          rawResultCount: searchResponse.results.length,
        }),
        this.trace.recordEvent("search_completed", {
          queryId: plan.id,
          sourceId: plan.sourceId,
          provider: "exa",
          parsedSignalCount: parsed?.signals.length ?? 0,
        }),
      ]);
    }

    if (!parsed) {
      return [];
    }

    return mapParsedSignals(plan, now, parsed.signals, 0.92);
  }
}