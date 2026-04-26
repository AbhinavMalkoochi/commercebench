import {
  AgentToolDefinition,
  AgentToolMap,
  AgentToolName,
  AgentToolRegistry,
  AgentRuntimeStage,
  AnyAgentToolDefinition,
} from "@/agent/core/tools";
import { fetchWebPageTool } from "@/agent/tools/fetch-web-page";
import { getTikTokAffiliateTool } from "@/agent/tools/get-tiktok-affiliate";

const REGISTERED_TOOLS = [fetchWebPageTool, getTikTokAffiliateTool] as const satisfies readonly AnyAgentToolDefinition[];

export class StaticToolRegistry implements AgentToolRegistry {
  private readonly toolMap = new Map(REGISTERED_TOOLS.map((tool) => [tool.name, tool]));

  listTools(): AnyAgentToolDefinition[] {
    return [...REGISTERED_TOOLS];
  }

  listToolsForStage(stage: AgentRuntimeStage): AnyAgentToolDefinition[] {
    return REGISTERED_TOOLS.filter((tool) => tool.stage === stage);
  }

  getTool<Name extends AgentToolName>(
    name: Name,
  ): AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]> {
    const tool = this.toolMap.get(name);

    if (!tool) {
      throw new Error(`Unknown agent tool: ${name}`);
    }

    return tool as AgentToolDefinition<Name, AgentToolMap[Name]["input"], AgentToolMap[Name]["output"]>;
  }
}

export function createDefaultToolRegistry(): AgentToolRegistry {
  return new StaticToolRegistry();
}