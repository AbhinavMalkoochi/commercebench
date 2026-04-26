import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { QueryPlan, ResearchSignal, SearchProvider, SourceId } from "@/agent/core/types";

const signalSchema = z.object({
  signals: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      sourceUrl: z.string().nullable(),
      tags: z.array(z.string()),
      priceMin: z.number().nullable(),
      priceMax: z.number().nullable(),
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

function normalizeSourceUrl(sourceUrl: string | null): string | undefined {
  if (!sourceUrl) {
    return undefined;
  }

  try {
    return new URL(sourceUrl).toString();
  } catch {
    return undefined;
  }
}

function getSearchSignalKind(sourceId: SourceId): ResearchSignal["kind"] {
  switch (sourceId) {
    case "tiktok_creator_search":
      return "market_theme";
    default:
      return "candidate";
  }
}

function buildSearchInstructions(plan: QueryPlan, now: Date): string {
  const common = [
    "Search the web for live ecommerce product signals.",
    "Return only evidence that appears current for the current month or recent TikTok activity.",
    "Reject regulated or restricted categories.",
    "Prefer products or categories that are realistically sellable under $100.",
    "Use short normalized labels such as 'lip gloss', 'portable sunscreen sticks', or 'heatless hair curlers'.",
    "Do not prefix labels with words like signal, insight, current, analytics, or trend report.",
    "Ignore advertiser help pages, incentive programs, product preview docs, and ad-platform feature announcements.",
    "Do not default scores to 0. Estimate each metric from the evidence and reserve 0 only for clearly absent evidence.",
    "Every signal must include tags as an array, sourceUrl as a URL or null, and priceMin/priceMax as numbers or null.",
    "Freshness rubric: 0.9-1.0 for explicit last-7-day or current TikTok Shop / Creative Center signals, 0.6-0.8 for current 2026 evidence, 0.2-0.5 for evergreen editorial evidence, 0-0.1 for stale or unclear timing.",
    `Date: ${now.toISOString()}`,
    `Query: ${plan.query}`,
  ];

  switch (plan.sourceId) {
    case "tiktok_creative_center":
      common.push(
        "Return concrete shoppable products or product categories from TikTok Shop / Creative Center.",
        "Prefer consumer-facing product categories over branded SKU titles when possible.",
      );
      break;
    case "tiktok_hashtag_search":
      common.push(
        "Infer concrete product categories or shopping niches from hashtag and category momentum.",
        "Return product labels like 'shampoo and conditioner' or 'lip gloss', not analytics-page titles.",
      );
      break;
    case "tiktok_creator_search":
      common.push(
        "Return creator behavior themes, content angles, and buyer problems instead of concrete products.",
        "Examples of good labels: 'grwm skincare fixes', 'travel packing upgrades', 'budget room glow-ups'.",
      );
      break;
    default:
      break;
  }

  return common.join("\n\n");
}

function isObviousPlatformNoise(signal: z.infer<typeof signalSchema>["signals"][number]): boolean {
  const combined = `${signal.label} ${signal.summary} ${signal.sourceUrl ?? ""}`.toLowerCase();

  return [
    "advertiser incentive",
    "ads manager",
    "creative exchange",
    "product preview",
    "help/article",
    "signal a:",
    "signal b:",
    "signal c:",
    "signal d:",
    "signal e:",
  ].some((pattern) => combined.includes(pattern));
}

export class OpenAiSearchProvider implements SearchProvider {
  constructor(
    private readonly client: OpenAI,
    private readonly model = "gpt-5.4",
  ) {}

  async searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]> {
    const signalKind = getSearchSignalKind(plan.sourceId);
    const response = await this.client.responses.parse({
      model: this.model,
      input: buildSearchInstructions(plan, now),
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

    return parsed.signals
      .filter((signal) => !isObviousPlatformNoise(signal))
      .map((signal, index) => ({
        id: `${plan.id}-search-signal-${index + 1}`,
        kind: signalKind,
        sourceId: plan.sourceId,
        queryId: plan.id,
        query: plan.query,
        sourceMode: "search_backed",
        sourceUrl: normalizeSourceUrl(signal.sourceUrl),
        label: signalKind === "candidate" ? signal.label : undefined,
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