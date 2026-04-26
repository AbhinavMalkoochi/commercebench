import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { QueryPlan, ResearchCycleResult } from "@/agent/core/types";
import { auditResearchSignals } from "@/agent/core/research-quality";

async function readJsonFile<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function findLatestTrace(baseDirectory: string): Promise<string> {
  const entries = (await readdir(baseDirectory)).sort().reverse();

  if (entries.length === 0) {
    throw new Error("No trace directories were found.");
  }

  return path.join(baseDirectory, entries[0]);
}

async function main(): Promise<void> {
  const tracesDirectory = path.join(process.cwd(), ".agent-state", "live", "traces");
  const traceDirectory = await findLatestTrace(tracesDirectory);
  const result = await readJsonFile<ResearchCycleResult>(path.join(traceDirectory, "loop", "result.json"));
  const queryPlanPath = path.join(traceDirectory, "loop", "query-plan.json");
  const queries = await readJsonFile<QueryPlan[]>(queryPlanPath);
  const queryById = new Map(queries.map((query) => [query.id, query]));
  const report = auditResearchSignals(result.signals, queryById, new Date(result.completedAt));
  const selectedCandidate = result.selectedCandidate;
  const selectedEvidence = selectedCandidate?.evidence.map((signal) => ({
    label: signal.label,
    sourceTitle: signal.sourceTitle,
    sourcePublishedAt: signal.sourcePublishedAt,
    sourceUrl: signal.sourceUrl,
    freshness: signal.metrics.freshness,
    freshnessNote: signal.freshnessNote,
  }));

  console.log(JSON.stringify({
    traceDirectory,
    status: result.status,
    selectedCandidate: selectedCandidate?.label,
    reasoning: result.reasoning,
    totalSignals: result.signals.length,
    acceptedSignals: report.acceptedSignals,
    rejectedSignals: report.rejectedSignals,
    rejectedAudits: report.audits.filter((audit) => !audit.accepted),
    selectedEvidence,
  }, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});