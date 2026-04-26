import {
  HtmlSourceClient,
  MetricVector,
  QueryPlan,
  ResearchSignal,
  SourceCapability,
  SourceId,
  SourceMode,
} from "@/agent/core/types";

const STOP_WORDS = new Set([
  "and",
  "for",
  "from",
  "into",
  "that",
  "this",
  "with",
  "your",
]);

const DEMO_KEYWORDS = [
  "before-and-after",
  "before",
  "after",
  "demo",
  "grwm",
  "mirror",
  "routine",
  "show",
  "showcase",
  "tutorial",
  "unboxing",
  "video",
  "visual",
];

const CREATOR_KEYWORDS = [
  "affiliate",
  "creator",
  "fyp",
  "hashtag",
  "influencer",
  "review",
  "small creator",
  "tiktok",
  "ugc",
  "viral",
];

const PURCHASE_INTENT_KEYWORDS = [
  "bestselling",
  "buyers",
  "demand",
  "easy to explain",
  "popular",
  "purchase",
  "sold",
  "top product",
  "winner",
];

const SATURATION_RISK_KEYWORDS = [
  "commodity",
  "competition",
  "generic",
  "not an empty market",
  "price competition",
  "saturated",
];

const SEASONAL_KEYWORDS = [
  "beach",
  "commute",
  "graduation",
  "june",
  "may",
  "outdoor",
  "summer",
  "travel",
  "vacation",
  "warm-weather",
  "wedding",
];

const DIRECT_SOURCE_DEFINITIONS = {
  shopify_tiktok_products: {
    url: "https://www.shopify.com/blog/tiktok-products",
    mode: "direct_fetch" as const,
    title: "Shopify TikTok products",
    notes: "Public article with category and product examples. Useful as a category prior, not as a hard freshness gate.",
  },
  shopify_tiktok_trends: {
    url: "https://www.shopify.com/blog/tiktok-trends",
    mode: "direct_fetch" as const,
    title: "Shopify TikTok trends",
    notes: "Public article with trend formats and behavior themes. Better for market-theme support than direct product gating.",
  },
  cj_winning_products: {
    url: "https://cjdropshipping.com/blogs/winning-products/Best-Trending-Dropshipping-Products-for-May-2026",
    mode: "direct_fetch" as const,
    title: "CJ winning products",
    notes: "Fetchable and current enough for candidate generation, but not sufficient as sole proof.",
  },
  cj_tiktok_products: {
    url: "https://cjdropshipping.com/blogs/winning-products/TikTok-Viral-products-2026",
    mode: "direct_fetch" as const,
    title: "CJ TikTok products",
    notes: "Candidate generation source tied to TikTok-friendly product types.",
  },
  pinterest_predicts: {
    url: "https://business.pinterest.com/pinterest-predicts/",
    mode: "direct_fetch" as const,
    title: "Pinterest Predicts",
    notes: "Macro-trend source for seasonality and aesthetic alignment.",
  },
} satisfies Partial<Record<SourceId, { url: string; mode: SourceMode; title: string; notes: string }>>;

export const SOURCE_CAPABILITIES: Record<SourceId, SourceCapability> = {
  tiktok_creative_center: {
    id: "tiktok_creative_center",
    mode: "search_backed",
    title: "TikTok Creative Center",
    primaryUrl: "https://ads.tiktok.com/business/creativecenter/top-products/pc/en",
    requiresAuth: false,
    notes: "Dynamic surface. Use search-backed extraction instead of raw HTML scraping.",
  },
  tiktok_creator_search: {
    id: "tiktok_creator_search",
    mode: "search_backed",
    title: "TikTok creator search",
    primaryUrl: "https://www.tiktok.com/",
    requiresAuth: false,
    notes: "Use search-backed extraction to identify current creator behavior.",
  },
  tiktok_hashtag_search: {
    id: "tiktok_hashtag_search",
    mode: "search_backed",
    title: "TikTok hashtag search",
    primaryUrl: "https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en",
    requiresAuth: false,
    notes: "Use search-backed extraction for current hashtag momentum.",
  },
  shopify_tiktok_products: {
    id: "shopify_tiktok_products",
    mode: "direct_fetch",
    title: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_products.title,
    primaryUrl: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_products.url,
    requiresAuth: false,
    notes: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_products.notes,
  },
  shopify_tiktok_trends: {
    id: "shopify_tiktok_trends",
    mode: "direct_fetch",
    title: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_trends.title,
    primaryUrl: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_trends.url,
    requiresAuth: false,
    notes: DIRECT_SOURCE_DEFINITIONS.shopify_tiktok_trends.notes,
  },
  cj_winning_products: {
    id: "cj_winning_products",
    mode: "direct_fetch",
    title: DIRECT_SOURCE_DEFINITIONS.cj_winning_products.title,
    primaryUrl: DIRECT_SOURCE_DEFINITIONS.cj_winning_products.url,
    requiresAuth: false,
    notes: DIRECT_SOURCE_DEFINITIONS.cj_winning_products.notes,
  },
  cj_tiktok_products: {
    id: "cj_tiktok_products",
    mode: "direct_fetch",
    title: DIRECT_SOURCE_DEFINITIONS.cj_tiktok_products.title,
    primaryUrl: DIRECT_SOURCE_DEFINITIONS.cj_tiktok_products.url,
    requiresAuth: false,
    notes: DIRECT_SOURCE_DEFINITIONS.cj_tiktok_products.notes,
  },
  pinterest_predicts: {
    id: "pinterest_predicts",
    mode: "direct_fetch",
    title: DIRECT_SOURCE_DEFINITIONS.pinterest_predicts.title,
    primaryUrl: DIRECT_SOURCE_DEFINITIONS.pinterest_predicts.url,
    requiresAuth: false,
    notes: DIRECT_SOURCE_DEFINITIONS.pinterest_predicts.notes,
  },
};

export const DIRECT_SOURCE_IDS = new Set<SourceId>([
  "shopify_tiktok_products",
  "shopify_tiktok_trends",
  "cj_winning_products",
  "cj_tiktok_products",
  "pinterest_predicts",
]);

type Section = {
  title: string;
  block: string;
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function countMatches(text: string, keywords: string[]): number {
  const normalized = text.toLowerCase();

  return keywords.reduce(
    (count, keyword) => count + (normalized.includes(keyword.toLowerCase()) ? 1 : 0),
    0,
  );
}

function normalizeTags(parts: string[]): string[] {
  const tags = parts
    .flatMap((part) => part.toLowerCase().split(/[^a-z0-9]+/g))
    .filter((part) => part.length > 2 && !STOP_WORDS.has(part));

  return [...new Set(tags)].slice(0, 8);
}

function getBaseFreshness(sourceId: SourceId): number {
  switch (sourceId) {
    case "cj_winning_products":
      return 0.88;
    case "cj_tiktok_products":
      return 0.75;
    case "pinterest_predicts":
      return 0.72;
    case "shopify_tiktok_products":
      return 0.38;
    case "shopify_tiktok_trends":
      return 0.4;
    default:
      return 0.5;
  }
}

function getSourceAuthority(sourceId: SourceId): number {
  switch (sourceId) {
    case "cj_winning_products":
    case "cj_tiktok_products":
      return 0.78;
    case "pinterest_predicts":
      return 0.74;
    case "shopify_tiktok_products":
    case "shopify_tiktok_trends":
      return 0.68;
    default:
      return 0.5;
  }
}

function extractPriceBand(block: string) {
  const matches = [...block.matchAll(/\$(\d{1,3})(?:\s*[-–]\s*\$?(\d{1,3}))?/g)];

  if (matches.length === 0) {
    return undefined;
  }

  const prices = matches.flatMap((match) => {
    const min = Number(match[1]);
    const max = match[2] ? Number(match[2]) : min;
    return [min, max];
  });

  return {
    currency: "USD" as const,
    min: Math.min(...prices),
    max: Math.max(...prices),
  };
}

function buildMetrics(
  sourceId: SourceId,
  label: string,
  block: string,
  priceBand?: { min?: number; max?: number; currency: "USD" },
): { metrics: MetricVector; confidence: number; tags: string[] } {
  const combined = `${label} ${block}`;
  const demoScore = clamp(0.45 + countMatches(combined, DEMO_KEYWORDS) * 0.08);
  const creatorScore = clamp(0.4 + countMatches(combined, CREATOR_KEYWORDS) * 0.08);
  const intentScore = clamp(0.45 + countMatches(combined, PURCHASE_INTENT_KEYWORDS) * 0.09);
  const saturationRisk = clamp(countMatches(combined, SATURATION_RISK_KEYWORDS) * 0.12);
  const saturationResistance = clamp(0.85 - saturationRisk);
  const seasonality = clamp(0.4 + countMatches(combined, SEASONAL_KEYWORDS) * 0.08);
  const priceFit = (() => {
    if (!priceBand?.max) {
      return 0.72;
    }

    if (priceBand.max <= 40) {
      return 0.95;
    }

    if (priceBand.max <= 75) {
      return 0.78;
    }

    if (priceBand.max <= 100) {
      return 0.58;
    }

    return 0.1;
  })();
  const freshness = getBaseFreshness(sourceId);
  const sourceAuthority = getSourceAuthority(sourceId);
  const confidence = clamp(
    freshness * 0.35 + sourceAuthority * 0.25 + intentScore * 0.2 + creatorScore * 0.2,
  );

  return {
    metrics: {
      freshness,
      visualDemo: demoScore,
      creatorAppeal: creatorScore,
      purchaseIntent: intentScore,
      priceFit,
      saturationResistance,
      seasonality,
      sourceAuthority,
    },
    confidence,
    tags: normalizeTags([label, block]),
  };
}

function summarizeBlock(block: string): string {
  const trimmed = block.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 260) {
    return trimmed;
  }

  return `${trimmed.slice(0, 257).trim()}...`;
}

function extractNumberedSections(text: string): Section[] {
  const matches = [...text.matchAll(/(?:^|\n)(\d{1,2})\.\s+([^\n]+)/g)];
  const sections = new Map<string, Section>();

  matches.forEach((match, index) => {
    const title = match[2].trim();
    const start = match.index ?? 0;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? text.length) : text.length;
    const block = text.slice(start, end).trim();
    const key = title.toLowerCase();
    const existing = sections.get(key);

    if (!existing || block.length > existing.block.length) {
      sections.set(key, { title, block });
    }
  });

  return [...sections.values()];
}

function extractPinterestThemeSections(text: string): Section[] {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: Section[] = [];
  const seen = new Set<string>();
  const blacklist = new Set([
    "Explore the trends",
    "Download report",
    "Pinterest Predicts",
  ]);

  for (const line of lines) {
    if (blacklist.has(line)) {
      continue;
    }

    if (!/^[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+){0,2}$/.test(line)) {
      continue;
    }

    const key = line.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    sections.push({
      title: line,
      block: `${line} trend from Pinterest Predicts 2026.`,
    });
    seen.add(key);
  }

  return sections.slice(0, 12);
}

function buildSignalsFromSections(
  sourceId: SourceId,
  query: QueryPlan,
  sections: Section[],
  now: Date,
  kind: "candidate" | "market_theme",
): ResearchSignal[] {
  return sections.map((section, index) => {
    const priceBand = extractPriceBand(section.block);
    const { metrics, confidence, tags } = buildMetrics(
      sourceId,
      section.title,
      section.block,
      priceBand,
    );

    return {
      id: `${query.id}-${index + 1}`,
      kind,
      sourceId,
      queryId: query.id,
      query: query.query,
      sourceMode: SOURCE_CAPABILITIES[sourceId].mode,
      sourceUrl: SOURCE_CAPABILITIES[sourceId].primaryUrl,
      label: kind === "candidate" ? section.title : undefined,
      summary: summarizeBlock(section.block),
      tags,
      metrics,
      confidence,
      priceBand,
      detectedAt: now.toISOString(),
    };
  });
}

function parseSectionsForSource(sourceId: SourceId, text: string): Section[] {
  switch (sourceId) {
    case "shopify_tiktok_products":
    case "cj_winning_products":
    case "cj_tiktok_products":
      return extractNumberedSections(text).slice(0, 12);
    case "shopify_tiktok_trends":
      return extractNumberedSections(text).slice(0, 10);
    case "pinterest_predicts":
      return extractPinterestThemeSections(text);
    default:
      return [];
  }
}

export async function loadDirectSignals(
  query: QueryPlan,
  htmlClient: HtmlSourceClient,
  now: Date,
): Promise<ResearchSignal[]> {
  if (!(query.sourceId in DIRECT_SOURCE_DEFINITIONS)) {
    return [];
  }

  const definition = DIRECT_SOURCE_DEFINITIONS[
    query.sourceId as keyof typeof DIRECT_SOURCE_DEFINITIONS
  ];

  if (!definition) {
    return [];
  }

  const document = await htmlClient.fetchDocument(definition.url);
  const sections = parseSectionsForSource(query.sourceId, document.text);
  const kind =
    query.sourceId === "shopify_tiktok_trends" || query.sourceId === "pinterest_predicts"
      ? "market_theme"
      : "candidate";

  return buildSignalsFromSections(query.sourceId, query, sections, now, kind);
}