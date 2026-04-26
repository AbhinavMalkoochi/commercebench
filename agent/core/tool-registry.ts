import {
  AgentToolDefinition,
  AgentToolMap,
  AgentToolName,
  AgentToolRegistry,
  AgentRuntimeStage,
  AnyAgentToolDefinition,
} from "@/agent/core/tools";
import { fetchWebPageTool } from "@/agent/tools/fetch-web-page";
import { createPrintfulMockupTaskTool } from "@/agent/tools/create-printful-mockup-task";
import { createPrintfulStoreProductTool } from "@/agent/tools/create-printful-store-product";
import { getPrintfulMockupTaskTool } from "@/agent/tools/get-printful-mockup-task";
import { getPrintfulProductsTool } from "@/agent/tools/get-printful-products";
import { getPrintfulVariantPricesTool } from "@/agent/tools/get-printful-variant-prices";
import { getTikTokAffiliateTool } from "@/agent/tools/get-tiktok-affiliate";
import { queryCjProductsTool } from "@/agent/tools/query-cj-products";

const REGISTERED_TOOLS = [
  fetchWebPageTool,
  createPrintfulMockupTaskTool,
  createPrintfulStoreProductTool,
  getPrintfulMockupTaskTool,
  getPrintfulProductsTool,
  getPrintfulVariantPricesTool,
  getTikTokAffiliateTool,
  queryCjProductsTool,
] as const satisfies readonly AnyAgentToolDefinition[];

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