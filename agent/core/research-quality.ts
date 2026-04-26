import { QueryPlan, ResearchSignal } from "@/agent/core/types";

const LOW_QUALITY_HOSTS = new Set([
  "accio.com",
  "www.accio.com",
]);

function parseHostname(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

function isOfficialFreshSurface(hostname: string | undefined): boolean {
  return hostname === "ads.tiktok.com" || hostname === "shop.tiktok.com";
}

function countSubstantiveMetrics(signal: ResearchSignal): number {
  const metricValues = [
    signal.metrics.visualDemo,
    signal.metrics.creatorAppeal,
    signal.metrics.purchaseIntent,
    signal.metrics.priceFit,
    signal.metrics.saturationResistance,
    signal.metrics.seasonality,
  ];

  return metricValues.filter((value) => value >= 0.05).length;
}

function isRecentEnough(signal: ResearchSignal, now: Date, freshnessWindowDays: number): boolean {
  const hostname = parseHostname(signal.sourceUrl);

  if (isOfficialFreshSurface(hostname)) {
    return true;
  }

  if (!signal.sourcePublishedAt) {
    return false;
  }

  const publishedAt = new Date(signal.sourcePublishedAt);

  if (Number.isNaN(publishedAt.getTime())) {
    return false;
  }

  const freshnessWindowMs = freshnessWindowDays * 24 * 60 * 60 * 1000;
  return now.getTime() - publishedAt.getTime() <= freshnessWindowMs;
}

function collectSignalIssues(signal: ResearchSignal, now: Date, query: QueryPlan): string[] {
  const issues: string[] = [];
  const hostname = parseHostname(signal.sourceUrl);

  if (!signal.sourceUrl) {
    issues.push("missing_source_url");
  }

  if (hostname && LOW_QUALITY_HOSTS.has(hostname)) {
    issues.push("low_quality_domain");
  }

  if (signal.sourceUrl?.includes("/discover/") || signal.sourceUrl?.includes("/content/")) {
    issues.push("non_specific_tiktok_page");
  }

  if (!signal.sourceTitle) {
    issues.push("missing_source_title");
  }

  if (!signal.freshnessNote) {
    issues.push("missing_freshness_note");
  }

  if (!isRecentEnough(signal, now, query.freshnessWindowDays ?? 30)) {
    issues.push("stale_or_unverified_freshness");
  }

  if (countSubstantiveMetrics(signal) < 3) {
    issues.push("insufficient_metric_substance");
  }

  return issues;
}

export interface ResearchSignalAudit {
  signalId: string;
  label?: string;
  sourceUrl?: string;
  accepted: boolean;
  issues: string[];
}

export interface ResearchQualityReport {
  totalSignals: number;
  acceptedSignals: number;
  rejectedSignals: number;
  audits: ResearchSignalAudit[];
}

export function auditResearchSignals(
  signals: ResearchSignal[],
  queryById: Map<string, QueryPlan>,
  now: Date,
): ResearchQualityReport {
  const audits = signals.map((signal) => {
    const query = queryById.get(signal.queryId);
    const issues = query ? collectSignalIssues(signal, now, query) : ["missing_query_context"];

    return {
      signalId: signal.id,
      label: signal.label,
      sourceUrl: signal.sourceUrl,
      accepted: issues.length === 0,
      issues,
    } satisfies ResearchSignalAudit;
  });

  return {
    totalSignals: audits.length,
    acceptedSignals: audits.filter((audit) => audit.accepted).length,
    rejectedSignals: audits.filter((audit) => !audit.accepted).length,
    audits,
  };
}

export function filterResearchSignals(
  signals: ResearchSignal[],
  queryById: Map<string, QueryPlan>,
  now: Date,
): { acceptedSignals: ResearchSignal[]; report: ResearchQualityReport } {
  const report = auditResearchSignals(signals, queryById, now);
  const rejectedIds = new Set(
    report.audits.filter((audit) => !audit.accepted).map((audit) => audit.signalId),
  );

  return {
    acceptedSignals: signals.filter((signal) => !rejectedIds.has(signal.id)),
    report,
  };
}