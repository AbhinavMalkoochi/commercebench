import path from "node:path";
import OpenAI from "openai";
import { z } from "zod";

import { QueryPlan, ResearchSignal, SearchProvider, SourceId } from "@/agent/core/types";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";
import {
  buildSearchInstructions,
  buildSearchResponseFormat,
  mapParsedSignals,
  signalSchema,
} from "@/agent/infrastructure/search-signal-codec";

export class OpenAiSearchProvider implements SearchProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model = "gpt-5.4",
    private readonly trace?: FileResearchTrace,
  ) {}

  private getSearchContextSize(sourceId: SourceId): "low" | "medium" {
    switch (sourceId) {
      case "tiktok_shop_search":
      case "cj_tiktok_products":
      case "cj_winning_products":
        return "low";
      default:
        return "medium";
    }
  }

  async searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]> {
    const prompt = buildSearchInstructions(plan, now);
    const searchContextSize = this.getSearchContextSize(plan.sourceId);

    if (this.trace) {
      const baseName = this.trace.queryBaseName(plan.id);
      await Promise.all([
        this.trace.writeText(path.join("search", `${baseName}-prompt.txt`), prompt),
        this.trace.writeJson(path.join("search", `${baseName}-request.json`), {
          queryId: plan.id,
          sourceId: plan.sourceId,
          query: plan.query,
          allowedDomains: plan.allowedDomains,
          model: this.model,
          provider: "openai_web_search",
          searchContextSize,
        }),
        this.trace.recordEvent("search_started", {
          queryId: plan.id,
          sourceId: plan.sourceId,
        }),
      ]);
    }

    const response = await this.client.responses.parse({
      model: this.model,
      input: prompt,
      tools: [
        {
          type: "web_search",
          filters: plan.allowedDomains?.length
            ? { allowed_domains: plan.allowedDomains }
            : undefined,
          search_context_size: searchContextSize,
          user_location: {
            type: "approximate",
            country: "US",
          },
        },
      ],
      text: {
        format: buildSearchResponseFormat("search_signals"),
      },
    });

    const parsed = response.output_parsed as z.infer<typeof signalSchema> | null;

    if (this.trace) {
      const baseName = this.trace.queryBaseName(plan.id);
      await Promise.all([
        this.trace.writeJson(path.join("search", `${baseName}-response.json`), {
          outputText: response.output_text,
          parsed,
        }),
        this.trace.recordEvent("search_completed", {
          queryId: plan.id,
          sourceId: plan.sourceId,
          parsedSignalCount: parsed?.signals.length ?? 0,
        }),
      ]);
    }

    if (!parsed) {
      return [];
    }

    return mapParsedSignals(plan, now, parsed.signals, 0.95);
  }
}