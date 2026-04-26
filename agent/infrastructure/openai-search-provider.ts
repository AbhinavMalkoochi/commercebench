import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { QueryPlan, ResearchSignal, SearchProvider } from "@/agent/core/types";

const signalSchema = z.object({
  signals: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      sourceUrl: z.string().url().optional(),
      tags: z.array(z.string()).default([]),
      priceMin: z.number().nullable().optional(),
      priceMax: z.number().nullable().optional(),
      freshness: z.number().min(0).max(1),
      visualDemo: z.number().min(0).max(1),
      creatorAppeal: z.number().min(0).max(1),
      purchaseIntent: z.number().min(0).max(1),
      priceFit: z.number().min(0).max(1),
      saturationResistance: z.number().min(0).max(1),
      seasonality: z.number().min(0).max(1),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

function normalizeTags(tags: string[], label: string): string[] {
  const raw = [...tags, ...label.toLowerCase().split(/[^a-z0-9]+/g)];

  return [...new Set(raw.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(
    0,
    8,
  );
}

export class OpenAiSearchProvider implements SearchProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model = "gpt-5.4",
  ) {}

  async searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]> {
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        "Search the web for live ecommerce product signals.",
        "Return only products or product angles that appear current.",
        "Reject regulated or restricted categories.",
        "Prefer prices under $100.",
        `Date: ${now.toISOString()}`,
        `Query: ${plan.query}`,
      ].join("\n\n"),
      tools: [
        {
          type: "web_search",
          filters: plan.allowedDomains?.length
            ? { allowed_domains: plan.allowedDomains }
            : undefined,
          search_context_size: "medium",
          user_location: {
            type: "approximate",
            country: "US",
          },
        },
      ],
      text: {
        format: zodTextFormat(signalSchema, "search_signals"),
      },
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      return [];
    }

    return parsed.signals.map((signal, index) => ({
      id: `${plan.id}-search-signal-${index + 1}`,
      kind: "candidate",
      sourceId: plan.sourceId,
      queryId: plan.id,
      query: plan.query,
      sourceMode: "search_backed",
      sourceUrl: signal.sourceUrl,
      label: signal.label,
      summary: signal.summary,
      tags: normalizeTags(signal.tags, signal.label),
      metrics: {
        freshness: signal.freshness,
        visualDemo: signal.visualDemo,
        creatorAppeal: signal.creatorAppeal,
        purchaseIntent: signal.purchaseIntent,
        priceFit: signal.priceFit,
        saturationResistance: signal.saturationResistance,
        seasonality: signal.seasonality,
        sourceAuthority: 0.95,
      },
      confidence: signal.confidence,
      priceBand:
        signal.priceMin === null && signal.priceMax === null
          ? undefined
          : {
              currency: "USD",
              min: signal.priceMin ?? undefined,
              max: signal.priceMax ?? undefined,
            },
      detectedAt: now.toISOString(),
    }));
  }
}