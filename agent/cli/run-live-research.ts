import OpenAI from "openai";

import { AgentLoop } from "@/agent/core/agent-loop";
import { HeuristicReasoner, OpenAiReasoner } from "@/agent/core/reasoner";
import { FileStateStore } from "@/agent/infrastructure/file-state-store";
import { LiveHtmlSourceClient } from "@/agent/infrastructure/html-source-client";
import { OpenAiSearchProvider } from "@/agent/infrastructure/openai-search-provider";

async function main(): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for the live research runner.");
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-5.4";
  const client = new OpenAI({ apiKey });
  const loop = new AgentLoop(
    new FileStateStore(`${process.cwd()}/.agent-state/live`),
    {
      htmlClient: new LiveHtmlSourceClient(),
      searchProvider: new OpenAiSearchProvider(client, model),
      reasoner: process.env.OPENAI_DISABLE_REASONER === "1"
        ? new HeuristicReasoner()
        : new OpenAiReasoner(client, model),
    },
  );
  const record = await loop.runOnce(new Date());

  console.log(JSON.stringify(record.result, null, 2));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});