import { QueryPlan, ResearchSignal, SearchProvider } from "@/agent/core/types";

function normalizeKey(signal: ResearchSignal): string {
  const label = signal.label?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "unknown";
  return `${signal.sourceId}:${label}:${signal.sourceUrl ?? ""}`;
}

export class CompositeSearchProvider implements SearchProvider {
  constructor(private readonly providers: SearchProvider[]) {}

  async searchSignals(plan: QueryPlan, now: Date): Promise<ResearchSignal[]> {
    const signalSets = await Promise.all(this.providers.map((provider) => provider.searchSignals(plan, now)));
    const deduped = new Map<string, ResearchSignal>();

    for (const signal of signalSets.flat()) {
      const key = normalizeKey(signal);
      const existing = deduped.get(key);

      if (!existing || signal.confidence > existing.confidence) {
        deduped.set(key, signal);
      }
    }

    return [...deduped.values()];
  }
}