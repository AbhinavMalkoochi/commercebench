import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";

import {
  CandidatePortfolioEntry,
  ResearchDecision,
  ResearchReasoner,
} from "@/agent/core/types";

const decisionSchema = z.object({
  selectedCandidateKey: z.string(),
  backupCandidateKeys: z.array(z.string()).max(2),
  targetPersona: z.string(),
  marketingAngle: z.string(),
  reasoning: z.string(),
});

function buildCandidateSnapshot(candidate: CandidatePortfolioEntry): string {
  return [
    `candidate=${candidate.label}`,
    `key=${candidate.key}`,
    `score=${candidate.score.total}`,
    `sources=${candidate.sourceIds.join(", ")}`,
    `reasons=${candidate.score.reasons.join(", ")}`,
    `gate_passed=${candidate.score.gatePassed}`,
  ].join(" | ");
}

export class HeuristicReasoner implements ResearchReasoner {
  async decide(input: {
    candidates: CandidatePortfolioEntry[];
  }): Promise<ResearchDecision> {
    const [selectedCandidate, ...rest] = input.candidates.filter(
      (candidate) => candidate.score.gatePassed,
    );

    if (!selectedCandidate) {
      throw new Error("Cannot create a decision without a gate-passing candidate.");
    }

    return {
      selectedCandidateKey: selectedCandidate.key,
      backupCandidateKeys: rest.slice(0, 2).map((candidate) => candidate.key),
      targetPersona: `Impulse buyer interested in ${selectedCandidate.tags.slice(0, 2).join(" and ")}`,
      marketingAngle: selectedCandidate.score.reasons[0] ?? "fast visual proof",
      reasoning: `${selectedCandidate.label} won because it combined ${selectedCandidate.score.reasons.join(
        ", ",
      )} across ${selectedCandidate.sourceIds.length} sources.`,
    };
  }
}

export class OpenAiReasoner implements ResearchReasoner {
  constructor(
    private readonly client: OpenAI,
    private readonly model = "gpt-5.4",
  ) {}

  async decide(input: {
    now: Date;
    candidates: CandidatePortfolioEntry[];
  }): Promise<ResearchDecision> {
    const topCandidates = input.candidates.filter((candidate) => candidate.score.gatePassed).slice(0, 5);

    if (topCandidates.length === 0) {
      throw new Error("Cannot ask OpenAI to select from an empty candidate set.");
    }

    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        "You are selecting one ecommerce research candidate.",
        "Only choose from the provided candidates.",
        "Prefer the strongest fresh trend with creator appeal, visual demo strength, and sub-$100 price fit.",
        `Date: ${input.now.toISOString()}`,
        topCandidates.map(buildCandidateSnapshot).join("\n"),
      ].join("\n\n"),
      text: {
        format: zodTextFormat(decisionSchema, "research_decision"),
      },
    });

    const parsed = response.output_parsed;

    if (!parsed) {
      throw new Error("OpenAI reasoner returned an empty parsed response.");
    }

    return parsed;
  }
}