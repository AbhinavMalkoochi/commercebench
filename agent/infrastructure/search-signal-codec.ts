import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import { QueryPlan, ResearchSignal, SourceId } from "@/agent/core/types";

export const signalSchema = z.object({
  signals: z.array(
    z.object({
      label: z.string(),
      summary: z.string(),
      sourceUrl: z.string().nullable(),
      sourceTitle: z.string().nullable(),
      sourcePublishedAt: z.string().nullable(),
      freshnessNote: z.string().nullable(),
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

type ParsedSignal = z.infer<typeof signalSchema>["signals"][number];

function normalizeTags(tags: string[], label: string): string[] {
  const raw = [...tags, ...label.toLowerCase().split(/[^a-z0-9]+/g)];
  return [...new Set(raw.map((tag) => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 8);
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

function buildSourceSpecificInstructions(sourceId: SourceId): string[] {
  switch (sourceId) {
    case "tiktok_creative_center":
      return [
        "Focus on live TikTok Creative Center and closely related commerce sources.",
        "Return concrete shoppable products or product categories, not analytics surfaces.",
      ];
    case "tiktok_shop_search":
      return [
        "Focus on what is trending on TikTok Shop right now.",
        "Prefer evidence tied to products, creators, and purchase activity over generic trend roundups.",
      ];
    case "tiktok_hashtag_search":
      return [
        "Use hashtag momentum only to infer actual product categories people are buying or demoing.",
        "Do not return hashtags themselves as products.",
      ];
    case "tiktok_made_me_buy_it_search":
      return [
        "Focus on products repeatedly appearing in TikTok-made-me-buy-it style content this month.",
        "Prefer products with clear buying intent, not just entertainment value.",
      ];
    case "shopify_tiktok_products":
      return [
        "Use Shopify as a supporting commerce source, not as the sole freshness proof.",
      ];
    case "shopify_tiktok_trends":
      return [
        "Use Shopify trend reporting as corroboration for product demand patterns.",
      ];
    case "cj_winning_products":
      return [
        "Use CJ as a supplier-side demand signal and shortlist products that can realistically be sourced and sold.",
      ];
    case "cj_tiktok_products":
      return [
        "Focus on CJ products with explicit TikTok relevance this month.",
      ];
  }
}

export function buildSearchInstructions(plan: QueryPlan, now: Date): string {
  return [
    "Search for live ecommerce product signals.",
    "Return only products or product categories that appear current for this month or the last 7 days.",
    "Reject regulated or restricted categories.",
    "Prefer products that are visually demonstrable on TikTok and realistically sellable under $100.",
    "Do not invent evidence. If evidence is weak or stale, omit the product.",
    "Use short normalized labels such as 'pimple patches' or 'heatless curlers'.",
    "Ignore platform help pages, advertiser docs, incentive pages, creator program docs, and analytics product pages.",
    "Every signal must include tags as an array, sourceUrl as a URL or null, and priceMin/priceMax as numbers or null.",
    "Every signal must include sourceTitle as a string or null, sourcePublishedAt as an ISO date string or null, and freshnessNote as a short explanation or null.",
    "Estimate freshness, visualDemo, creatorAppeal, purchaseIntent, priceFit, saturationResistance, seasonality, and confidence from the evidence you find.",
    "Choose products, not marketing hooks. Marketing research is out of scope for this pass.",
    ...buildSourceSpecificInstructions(plan.sourceId),
    `Date: ${now.toISOString()}`,
    `Query: ${plan.query}`,
  ].join("\n\n");
}

export function buildSearchResponseFormat(schemaName: string) {
  return zodTextFormat(signalSchema, schemaName);
}

function isObviousPlatformNoise(signal: ParsedSignal): boolean {
  const combined = `${signal.label} ${signal.summary} ${signal.sourceUrl ?? ""}`.toLowerCase();

  return [
    "advertiser incentive",
    "ads manager",
    "creative exchange",
    "product preview",
    "help/article",
    "creator academy",
    "seller university",
    "signal a:",
    "signal b:",
    "signal c:",
    "signal d:",
    "signal e:",
  ].some((pattern) => combined.includes(pattern));
}

export function mapParsedSignals(
  plan: QueryPlan,
  now: Date,
  parsedSignals: ParsedSignal[],
  sourceAuthority: number,
): ResearchSignal[] {
  return parsedSignals
    .filter((signal) => !isObviousPlatformNoise(signal))
    .map((signal, index) => ({
      id: `${plan.id}-search-signal-${index + 1}`,
      kind: "candidate" as const,
      sourceId: plan.sourceId,
      queryId: plan.id,
      query: plan.query,
      sourceMode: "search_backed" as const,
      sourceUrl: normalizeSourceUrl(signal.sourceUrl),
      sourceTitle: signal.sourceTitle ?? undefined,
      sourcePublishedAt: signal.sourcePublishedAt ?? undefined,
      label: signal.label,
      summary: signal.summary,
      freshnessNote: signal.freshnessNote ?? undefined,
      tags: normalizeTags(signal.tags, signal.label),
      metrics: {
        freshness: signal.freshness,
        visualDemo: signal.visualDemo,
        creatorAppeal: signal.creatorAppeal,
        purchaseIntent: signal.purchaseIntent,
        priceFit: signal.priceFit,
        saturationResistance: signal.saturationResistance,
        seasonality: signal.seasonality,
        sourceAuthority,
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