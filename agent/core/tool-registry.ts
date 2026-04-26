import {
  AgentToolDefinition,
  AgentToolMap,
  AgentToolName,
  AgentToolRegistry,
  AnyAgentToolDefinition,
} from "@/agent/core/tools";
import { getTikTokAffiliateTool } from "@/agent/tools/get-tiktok-affiliate";

const REGISTERED_TOOLS = [getTikTokAffiliateTool] as const satisfies readonly AnyAgentToolDefinition[];

export class StaticToolRegistry implements AgentToolRegistry {
  private readonly toolMap = new Map(REGISTERED_TOOLS.map((tool) => [tool.name, tool]));

  listTools(): AnyAgentToolDefinition[] {
    return [...REGISTERED_TOOLS];
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