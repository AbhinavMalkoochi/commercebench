import {
  MINIMUM_QUERY_COUNT,
  MINIMUM_USEFUL_SIGNAL_COUNT,
  QueryPlan,
  ResearchCycleResult,
  ResearchReasoner,
  ResearchSignal,
  SearchProvider,
  SourceCapability,
} from "@/agent/core/types";
import { buildResearchQueryPlan } from "@/agent/core/query-planner";
import { filterResearchSignals } from "@/agent/core/research-quality";
import { buildCandidatePortfolio, countUsefulCandidateSignals } from "@/agent/core/scoring";
import { SOURCE_CAPABILITIES } from "@/agent/sources/catalog";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

export interface ResearchLoopDependencies {
  reasoner: ResearchReasoner;
  searchProvider?: SearchProvider;
  trace?: FileResearchTrace;
}

const DEFAULT_SOURCE_OPERATION_TIMEOUT_MS = 180_000;

function getSourceOperationTimeoutMs(): number {
  const configuredValue = Number(process.env.AGENT_SOURCE_TIMEOUT_MS);

  if (Number.isFinite(configuredValue) && configuredValue >= 30_000) {
    return configuredValue;
  }

  return DEFAULT_SOURCE_OPERATION_TIMEOUT_MS;
}

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
  const sourceOperationTimeoutMs = getSourceOperationTimeoutMs();

  await dependencies.trace?.writeJson("loop/query-plan.json", queries);
  await dependencies.trace?.recordEvent("research_loop_started", {
    startedAt,
    queryCount: queries.length,
  });

  const signalSets = await Promise.all<ResearchSignal[]>(
    queries.map(async (query) => {
      await dependencies.trace?.recordEvent("query_started", {
        queryId: query.id,
        sourceId: query.sourceId,
        mode: "search_backed",
      });

      if (!dependencies.searchProvider) {
        return [];
      }

      try {
        const searchSignals = await withTimeout(
          dependencies.searchProvider.searchSignals(query, now),
          sourceOperationTimeoutMs,
          query.sourceId,
        );
        await dependencies.trace?.recordEvent("query_completed", {
          queryId: query.id,
          sourceId: query.sourceId,
          signalCount: searchSignals.length,
        });
        return searchSignals;
      } catch {
        await dependencies.trace?.recordEvent("query_failed", {
          queryId: query.id,
          sourceId: query.sourceId,
        });
        return [];
      }
    }),
  );
  const rawSignals = signalSets.flat();
  const queryById = new Map(queries.map((query) => [query.id, query]));
  const { acceptedSignals: signals, report: qualityReport } = filterResearchSignals(
    rawSignals,
    queryById,
    now,
  );

  const candidates = buildCandidatePortfolio(signals);
  const usefulSignalCount = countUsefulCandidateSignals(signals);
  const gatePassingCandidates = candidates.filter((candidate) => candidate.score.gatePassed);
  const completedAt = new Date().toISOString();

  await Promise.all([
    dependencies.trace?.writeJson("loop/raw-signals.json", rawSignals),
    dependencies.trace?.writeJson("loop/signals.json", signals),
    dependencies.trace?.writeJson("loop/research-quality.json", qualityReport),
    dependencies.trace?.writeJson("loop/candidates.json", candidates),
    dependencies.trace?.recordEvent("research_scoring_completed", {
      rawSignalCount: rawSignals.length,
      signalCount: signals.length,
      candidateCount: candidates.length,
      gatePassingCandidateCount: gatePassingCandidates.length,
      usefulSignalCount,
    }),
  ]);

  if (
    queries.length < MINIMUM_QUERY_COUNT ||
    usefulSignalCount < MINIMUM_USEFUL_SIGNAL_COUNT ||
    gatePassingCandidates.length === 0
  ) {
    const blockedResult = {
      status: "blocked_low_signal" as const,
      startedAt,
      completedAt,
      queries,
      signals,
      candidates,
      backupCandidates: [],
      reasoning: buildBlockedReason(queries, usefulSignalCount),
      sourceAudit: listSourceAudit(),
    };

    await Promise.all([
      dependencies.trace?.writeJson("loop/result.json", blockedResult),
      dependencies.trace?.recordEvent("research_loop_blocked", {
        completedAt,
        reasoning: blockedResult.reasoning,
      }),
    ]);

    return {
      ...blockedResult,
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

  const passedResult: ResearchCycleResult = {
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

  await Promise.all([
    dependencies.trace?.writeJson("loop/result.json", passedResult),
    dependencies.trace?.recordEvent("research_loop_passed", {
      completedAt,
      selectedCandidateKey: selectedCandidate.key,
    }),
  ]);

  return passedResult;
}