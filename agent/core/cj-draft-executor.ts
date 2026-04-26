import { AgentToolExecutionContext } from "@/agent/core/tools";
import { ToolExecutor } from "@/agent/core/tool-executor";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { CjDraftExecutionResult, ProductCreationDraft } from "@/agent/core/types";
import { CjDraftInspector } from "@/agent/core/cj-draft-inspector";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

export class CjDraftExecutor {
  private readonly inspector: CjDraftInspector;
  private readonly executor: ToolExecutor;
  private readonly policy = new DefaultToolPolicy();

  constructor(trace?: FileResearchTrace) {
    this.inspector = new CjDraftInspector(trace);
    this.executor = new ToolExecutor(createDefaultToolRegistry(), trace);
  }

  async executeDraft(
    draft: ProductCreationDraft,
    input: {
      apiKey: string;
      toolContext: AgentToolExecutionContext;
    },
  ): Promise<CjDraftExecutionResult> {
    if (draft.blueprint.provider !== "cj_dropshipping") {
      return {
        status: "skipped",
        reasoning: "The draft is not a CJ draft, so CJ execution was skipped.",
      };
    }

    const authTool = this.executor.getToolDefinition("get_cj_access_token");
    const authDecision = this.policy.evaluate(authTool, {
      stage: "product_creation",
    });

    if (!authDecision.allowed) {
      return {
        status: "blocked",
        reasoning: authDecision.reason,
      };
    }

    const authResult = await this.executor.execute(
      "get_cj_access_token",
      {
        apiKey: input.apiKey,
      },
      input.toolContext,
    );

    const inspection = await this.inspector.inspectDraft(draft, {
      accessToken: authResult.accessToken,
      toolContext: input.toolContext,
    });

    if (inspection.status !== "ready" || !inspection.selection) {
      return inspection;
    }

    return {
      status: "ready",
      reasoning: `${inspection.reasoning} Authenticated with CJ and resolved a provider-backed sourcing candidate.`,
      selection: inspection.selection,
      authentication: {
        sourceUrl: authResult.sourceUrl,
        openId: authResult.openId,
        accessTokenExpiryDate: authResult.accessTokenExpiryDate,
        refreshTokenExpiryDate: authResult.refreshTokenExpiryDate,
      },
    };
  }
}