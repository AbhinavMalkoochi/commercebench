import {
  MINIMUM_QUERY_COUNT,
  MINIMUM_USEFUL_SIGNAL_COUNT,
  QueryPlan,
  ResearchCycleResult,
  ResearchReasoner,
  SearchProvider,
  SourceCapability,
} from "@/agent/core/types";
import { buildResearchQueryPlan } from "@/agent/core/query-planner";
import { buildCandidatePortfolio, countUsefulCandidateSignals } from "@/agent/core/scoring";
import { HtmlSourceClient } from "@/agent/core/types";
import {
  DIRECT_SOURCE_IDS,
  SOURCE_CAPABILITIES,
  loadDirectSignals,
} from "@/agent/sources/catalog";

export interface ResearchLoopDependencies {
  htmlClient: HtmlSourceClient;
  reasoner: ResearchReasoner;
  searchProvider?: SearchProvider;
}

const SOURCE_OPERATION_TIMEOUT_MS = 90_000;

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms.`)), timeoutMs);
    }),
  ]);
}

function buildBlockedReason(queries: QueryPlan[], usefulSignalCount: number): string {
  if (queries.length < MINIMUM_QUERY_COUNT) {
    return "Research loop did not schedule enough queries to satisfy the hard gate.";
  }

  if (usefulSignalCount < MINIMUM_USEFUL_SIGNAL_COUNT) {
    return "Fewer than three useful candidate signals were found, so the cycle stayed blocked.";
  }

  return "No candidate cleared the deterministic research gates, so the cycle stayed blocked.";
}

function listSourceAudit(): SourceCapability[] {
  return Object.values(SOURCE_CAPABILITIES);
}

export async function runResearchLoop(
  dependencies: ResearchLoopDependencies,
  now: Date,
): Promise<ResearchCycleResult> {
  const startedAt = now.toISOString();
  const queries = buildResearchQueryPlan(now);
  const signalSets = await Promise.all(
    queries.map(async (query) => {
      if (DIRECT_SOURCE_IDS.has(query.sourceId)) {
        try {
          return await withTimeout(
            loadDirectSignals(query, dependencies.htmlClient, now),
            SOURCE_OPERATION_TIMEOUT_MS,
            query.sourceId,
          );
        } catch {
          return [];
        }
      }

      if (!dependencies.searchProvider) {
        return [];
      }

      try {
        return await withTimeout(
          dependencies.searchProvider.searchSignals(query, now),
          SOURCE_OPERATION_TIMEOUT_MS,
          query.sourceId,
        );
      } catch {
        return [];
      }
    }),
  );
  const signals = signalSets.flat();

  const candidates = buildCandidatePortfolio(signals);
  const usefulSignalCount = countUsefulCandidateSignals(signals);
  const gatePassingCandidates = candidates.filter((candidate) => candidate.score.gatePassed);
  const completedAt = new Date().toISOString();

  if (
    queries.length < MINIMUM_QUERY_COUNT ||
    usefulSignalCount < MINIMUM_USEFUL_SIGNAL_COUNT ||
    gatePassingCandidates.length === 0
  ) {
    return {
      status: "blocked_low_signal",
      startedAt,
      completedAt,
      queries,
      signals,
      candidates,
      backupCandidates: [],
      reasoning: buildBlockedReason(queries, usefulSignalCount),
      sourceAudit: listSourceAudit(),
    };
  }

  const decision = await dependencies.reasoner.decide({
    now,
    queries,
    signals,
    candidates: gatePassingCandidates,
  });
  const selectedCandidate =
    gatePassingCandidates.find(
      (candidate) => candidate.key === decision.selectedCandidateKey,
    ) ?? gatePassingCandidates[0];
  const backupCandidates = gatePassingCandidates.filter(
    (candidate) =>
      candidate.key !== selectedCandidate.key &&
      decision.backupCandidateKeys.includes(candidate.key),
  );

  return {
    status: "passed",
    startedAt,
    completedAt,
    queries,
    signals,
    candidates,
    selectedCandidate,
    backupCandidates,
    decision,
    reasoning: decision.reasoning,
    sourceAudit: listSourceAudit(),
  };
}