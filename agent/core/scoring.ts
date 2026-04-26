import {
  CandidatePortfolioEntry,
  CandidateScore,
  MAX_ALLOWED_PRODUCT_PRICE,
  RESTRICTED_PRODUCT_KEYWORDS,
  ResearchSignal,
} from "@/agent/core/types";

const WEIGHTS = {
  freshness: 0.22,
  signalCoverage: 0.16,
  visualDemo: 0.16,
  creatorAppeal: 0.16,
  purchaseIntent: 0.12,
  priceFit: 0.1,
  saturationResistance: 0.08,
  seasonality: 0.1,
} as const;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function unique<T>(values: Iterable<T>): T[] {
  return [...new Set(values)];
}

function normalizeLabel(label: string): string {
  return label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function candidateHasRestrictedKeyword(label: string, tags: string[]): boolean {
  const combined = `${label} ${tags.join(" ")}`.toLowerCase();

  return RESTRICTED_PRODUCT_KEYWORDS.some((keyword) => combined.includes(keyword));
}

function getCombinedPriceBand(signals: ResearchSignal[]): number | undefined {
  const maxValues = signals
    .map((signal) => signal.priceBand?.max)
    .filter((value): value is number => typeof value === "number");

  if (maxValues.length === 0) {
    return undefined;
  }

  return Math.max(...maxValues);
}

function buildThemeAlignment(candidateTags: string[], marketSignals: ResearchSignal[]): number {
  const marketTags = new Set(
    marketSignals.flatMap((signal) => signal.tags.map((tag) => tag.toLowerCase())),
  );
  const candidateTagSet = new Set(candidateTags.map((tag) => tag.toLowerCase()));
  const overlap = [...candidateTagSet].filter((tag) => marketTags.has(tag));

  if (candidateTagSet.size === 0) {
    return 0;
  }

  return clamp(overlap.length / Math.min(candidateTagSet.size, 4));
}

function buildReasons(score: Omit<CandidateScore, "gatePassed" | "gateReasons" | "reasons">): string[] {
  const rankedReasons: Array<[string, number]> = [
    ["fresh demand signal", score.freshness],
    ["strong creator appeal", score.creatorAppeal],
    ["easy to demo visually", score.visualDemo],
    ["clear purchase intent", score.purchaseIntent],
    ["good price fit", score.priceFit],
    ["seasonal relevance", score.seasonality],
    ["manageable competition", score.saturationResistance],
  ];

  const positiveReasons = rankedReasons.filter(([, value]) => value >= 0.35);

  if (positiveReasons.length > 0) {
    return positiveReasons
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([reason]) => reason);
  }

  return rankedReasons
    .sort((left, right) => right[1] - left[1])
    .slice(0, 1)
    .map(([reason]) => reason);
}

function scoreCandidate(
  label: string,
  tags: string[],
  evidence: ResearchSignal[],
  marketSignals: ResearchSignal[],
): CandidateScore {
  const sourceDiversity = unique(evidence.map((signal) => signal.sourceId)).length;
  const maxPrice = getCombinedPriceBand(evidence);

  const freshness = average(evidence.map((signal) => signal.metrics.freshness));
  const visualDemo = average(evidence.map((signal) => signal.metrics.visualDemo));
  const creatorAppeal = average(
    evidence.map((signal) => signal.metrics.creatorAppeal),
  );
  const purchaseIntent = average(
    evidence.map((signal) => signal.metrics.purchaseIntent),
  );
  const priceFit = average(evidence.map((signal) => signal.metrics.priceFit));
  const saturationResistance = average(
    evidence.map((signal) => signal.metrics.saturationResistance),
  );
  const themeAlignment = buildThemeAlignment(tags, marketSignals);
  const seasonality = clamp(
    average(evidence.map((signal) => signal.metrics.seasonality)) * 0.75 +
      themeAlignment * 0.25,
  );
  const signalCoverage = clamp((evidence.length / 4) * Math.min(sourceDiversity / 3, 1));
  const confidenceMultiplier = clamp(
    0.7 + average(evidence.map((signal) => signal.confidence)) * 0.3,
  );

  const gateReasons: string[] = [];

  if (evidence.length < 2) {
    gateReasons.push("needs at least two supporting signals");
  }

  if (sourceDiversity < 2) {
    gateReasons.push("needs confirmation from at least two sources");
  }

  if (freshness < 0.45) {
    gateReasons.push("freshness is too weak for current-trend selection");
  }

  if (candidateHasRestrictedKeyword(label, tags)) {
    gateReasons.push("falls into a restricted category");
  }

  if (typeof maxPrice === "number" && maxPrice > MAX_ALLOWED_PRODUCT_PRICE) {
    gateReasons.push("observed price exceeds the allowed product ceiling");
  }

  const rawScore =
    freshness * WEIGHTS.freshness +
    signalCoverage * WEIGHTS.signalCoverage +
    visualDemo * WEIGHTS.visualDemo +
    creatorAppeal * WEIGHTS.creatorAppeal +
    purchaseIntent * WEIGHTS.purchaseIntent +
    priceFit * WEIGHTS.priceFit +
    saturationResistance * WEIGHTS.saturationResistance +
    seasonality * WEIGHTS.seasonality;

  const score = {
    total: Number((rawScore * confidenceMultiplier).toFixed(4)),
    freshness: Number(freshness.toFixed(4)),
    signalCoverage: Number(signalCoverage.toFixed(4)),
    visualDemo: Number(visualDemo.toFixed(4)),
    creatorAppeal: Number(creatorAppeal.toFixed(4)),
    purchaseIntent: Number(purchaseIntent.toFixed(4)),
    priceFit: Number(priceFit.toFixed(4)),
    saturationResistance: Number(saturationResistance.toFixed(4)),
    seasonality: Number(seasonality.toFixed(4)),
    confidenceMultiplier: Number(confidenceMultiplier.toFixed(4)),
  };

  return {
    ...score,
    gatePassed: gateReasons.length === 0,
    gateReasons,
    reasons: buildReasons(score),
  };
}

export function countUsefulCandidateSignals(signals: ResearchSignal[]): number {
  return signals.filter((signal) => signal.kind === "candidate" && signal.label).length;
}

export function buildCandidatePortfolio(signals: ResearchSignal[]): CandidatePortfolioEntry[] {
  const candidateSignals = signals.filter(
    (signal): signal is ResearchSignal & { label: string } =>
      signal.kind === "candidate" && typeof signal.label === "string",
  );
  const marketSignals = signals.filter((signal) => signal.kind === "market_theme");

  const groupedSignals = new Map<string, ResearchSignal[]>();
  const labelByKey = new Map<string, string>();

  for (const signal of candidateSignals) {
    const key = normalizeLabel(signal.label);
    const existingSignals = groupedSignals.get(key) ?? [];

    existingSignals.push(signal);
    groupedSignals.set(key, existingSignals);

    const currentLabel = labelByKey.get(key);
    if (!currentLabel || signal.label.length > currentLabel.length) {
      labelByKey.set(key, signal.label);
    }
  }

  return [...groupedSignals.entries()]
    .map(([key, evidence]) => {
      const label = labelByKey.get(key) ?? key;
      const tags = unique(evidence.flatMap((signal) => signal.tags));

      return {
        key,
        label,
        tags,
        evidence,
        sourceIds: unique(evidence.map((signal) => signal.sourceId)),
        score: scoreCandidate(label, tags, evidence, marketSignals),
      };
    })
    .sort((left, right) => right.score.total - left.score.total);
}