import { ToolExecutor } from "@/agent/core/tool-executor";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { AgentToolExecutionContext } from "@/agent/core/tools";
import { CjDraftInspectionResult, ProductCreationDraft } from "@/agent/core/types";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

export class CjDraftInspector {
  private readonly executor: ToolExecutor;
  private readonly policy = new DefaultToolPolicy();

  constructor(trace?: FileResearchTrace) {
    this.executor = new ToolExecutor(createDefaultToolRegistry(), trace);
  }

  async inspectDraft(
    draft: ProductCreationDraft,
    input: {
      accessToken: string;
      toolContext: AgentToolExecutionContext;
    },
  ): Promise<CjDraftInspectionResult> {
    if (draft.blueprint.provider !== "cj_dropshipping") {
      return {
        status: "skipped",
        reasoning: "The draft is not a CJ draft, so CJ inspection was skipped.",
      };
    }

    const queryTool = this.executor.getToolDefinition("query_cj_products");
    const decision = this.policy.evaluate(queryTool, { stage: "product_creation" });

    if (!decision.allowed) {
      return {
        status: "blocked",
        reasoning: decision.reason,
      };
    }

    const queryResult = await this.executor.execute(
      "query_cj_products",
      {
        accessToken: input.accessToken,
        name: draft.blueprint.sourcingQuery,
      },
      input.toolContext,
    );

    const selected = queryResult.products[0];

    if (!selected) {
      return {
        status: "blocked",
        reasoning: `No CJ product matched sourcing query \"${draft.blueprint.sourcingQuery}\".`,
      };
    }

    return {
      status: "ready",
      reasoning: `Matched the draft to CJ product ${selected.name}.`,
      selection: {
        productId: selected.productId,
        name: selected.name,
        sku: selected.sku,
        price: selected.price,
        sourceUrl: queryResult.sourceUrl,
      },
    };
  }
}