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
import { createCjOrderDraftTool } from "@/agent/tools/create-cj-order-draft";
import { createPrintfulStoreProductTool } from "@/agent/tools/create-printful-store-product";
import { getCjAccessTokenTool } from "@/agent/tools/get-cj-access-token";
import { getCjBalanceTool } from "@/agent/tools/get-cj-balance";
import { getCjOrderDetailTool } from "@/agent/tools/get-cj-order-detail";
import { getCjOrdersTool } from "@/agent/tools/get-cj-orders";
import { getPrintfulMockupTaskTool } from "@/agent/tools/get-printful-mockup-task";
import { getPrintfulProductsTool } from "@/agent/tools/get-printful-products";
import { getPrintfulVariantPricesTool } from "@/agent/tools/get-printful-variant-prices";
import { getTikTokAccessTokenTool } from "@/agent/tools/get-tiktok-access-token";
import { getTikTokAffiliateTool } from "@/agent/tools/get-tiktok-affiliate";
import { getTikTokAuthorizedShopsTool } from "@/agent/tools/get-tiktok-authorized-shops";
import { queryCjProductsTool } from "@/agent/tools/query-cj-products";
import { refreshCjAccessTokenTool } from "@/agent/tools/refresh-cj-access-token";
import { refreshTikTokAccessTokenTool } from "@/agent/tools/refresh-tiktok-access-token";
import { runRemoteShellCommandTool } from "@/agent/tools/run-remote-shell-command";
import { searchTikTokOrdersTool } from "@/agent/tools/search-tiktok-orders";
import { searchTikTokProductsTool } from "@/agent/tools/search-tiktok-products";

const REGISTERED_TOOLS = [
  fetchWebPageTool,
  createCjOrderDraftTool,
  createPrintfulMockupTaskTool,
  createPrintfulStoreProductTool,
  getCjAccessTokenTool,
  getCjBalanceTool,
  getCjOrderDetailTool,
  getCjOrdersTool,
  getPrintfulMockupTaskTool,
  getPrintfulProductsTool,
  getPrintfulVariantPricesTool,
  getTikTokAccessTokenTool,
  getTikTokAffiliateTool,
  getTikTokAuthorizedShopsTool,
  queryCjProductsTool,
  refreshCjAccessTokenTool,
  refreshTikTokAccessTokenTool,
  runRemoteShellCommandTool,
  searchTikTokOrdersTool,
  searchTikTokProductsTool,
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