import { AgentToolExecutionContext } from "@/agent/core/tools";
import { ToolExecutor } from "@/agent/core/tool-executor";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import {
  PrintfulDraftExecutionResult,
  ProductCreationDraft,
} from "@/agent/core/types";
import { PrintfulDraftInspector } from "@/agent/core/printful-draft-inspector";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

const DEFAULT_MOCKUP_POSITION = {
  width: 10,
  height: 10,
  top: 0,
  left: 0,
};

export class PrintfulDraftExecutor {
  private readonly inspector: PrintfulDraftInspector;
  private readonly executor: ToolExecutor;
  private readonly policy = new DefaultToolPolicy();

  constructor(trace?: FileResearchTrace) {
    this.inspector = new PrintfulDraftInspector(trace);
    this.executor = new ToolExecutor(createDefaultToolRegistry(), trace);
  }

  async executeDraft(
    draft: ProductCreationDraft,
    input: {
      storeId: string;
      mockupStyleIds: number[];
      artworkUrl: string;
      approvedToolNames?: Array<"create_printful_mockup_task" | "get_printful_mockup_task">;
      toolContext: AgentToolExecutionContext;
      placement?: string;
      technique?: string;
      printAreaType?: string;
      orientation?: "vertical" | "horizontal";
      pollTask?: boolean;
    },
  ): Promise<PrintfulDraftExecutionResult> {
    const inspection = await this.inspector.inspectDraft(draft, {
      storeId: input.storeId,
      toolContext: input.toolContext,
    });

    if (inspection.status !== "ready" || !inspection.selection) {
      return inspection;
    }

    const createTool = this.executor.getToolDefinition("create_printful_mockup_task");
    const createDecision = this.policy.evaluate(createTool, {
      stage: "product_creation",
      approvedToolNames: input.approvedToolNames,
    });

    if (!createDecision.allowed) {
      return {
        status: "blocked",
        reasoning: createDecision.reason,
        selection: inspection.selection,
      };
    }

    const mockupTask = await this.executor.execute(
      "create_printful_mockup_task",
      {
        storeId: input.storeId,
        catalogProductId: inspection.selection.productId,
        catalogVariantIds: [inspection.selection.variantId],
        mockupStyleIds: input.mockupStyleIds,
        orientation: input.orientation,
        placements: [
          {
            placement: input.placement ?? "front",
            technique: input.technique ?? "dtg",
            printAreaType: input.printAreaType ?? "simple",
            imageUrl: input.artworkUrl,
            position: DEFAULT_MOCKUP_POSITION,
          },
        ],
      },
      input.toolContext,
    );

    if (!input.pollTask) {
      return {
        status: "ready",
        reasoning: `${inspection.reasoning} Created Printful mockup task ${mockupTask.taskId}.`,
        selection: inspection.selection,
        mockup: {
          taskId: mockupTask.taskId,
          status: mockupTask.status,
          sourceUrl: mockupTask.sourceUrl,
          assets: [],
          failureReasons: [],
        },
      };
    }

    const readTool = this.executor.getToolDefinition("get_printful_mockup_task");
    const readDecision = this.policy.evaluate(readTool, {
      stage: "product_creation",
      approvedToolNames: input.approvedToolNames,
    });

    if (!readDecision.allowed) {
      return {
        status: "blocked",
        reasoning: readDecision.reason,
        selection: inspection.selection,
      };
    }

    const mockupResult = await this.executor.execute(
      "get_printful_mockup_task",
      {
        taskId: mockupTask.taskId,
        storeId: input.storeId,
      },
      input.toolContext,
    );

    return {
      status: "ready",
      reasoning: `${inspection.reasoning} Created Printful mockup task ${mockupTask.taskId} and fetched the latest mockup task state.`,
      selection: inspection.selection,
      mockup: {
        taskId: mockupResult.taskId,
        status: mockupResult.status,
        sourceUrl: mockupResult.sourceUrl,
        assets: mockupResult.assets,
        failureReasons: mockupResult.failureReasons,
      },
    };
  }
}