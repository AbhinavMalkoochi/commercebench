import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CreatePrintfulMockupTaskInput,
  CreatePrintfulMockupTaskOutput,
} from "@/agent/core/tools";

const DEFAULT_PRINTFUL_MOCKUP_TASKS_URL = "https://api.printful.com/v2/mockup-tasks";

export async function create_printful_mockup_task(
  input: CreatePrintfulMockupTaskInput,
  context: AgentToolExecutionContext,
): Promise<CreatePrintfulMockupTaskOutput> {
  const url = input.pageUrl ?? DEFAULT_PRINTFUL_MOCKUP_TASKS_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
      "X-PF-Store-ID": input.storeId,
    },
    body: JSON.stringify({
      format: input.format ?? "jpg",
      mockup_width_px: input.mockupWidthPx ?? 1000,
      products: [
        {
          source: "catalog",
          mockup_style_ids: input.mockupStyleIds,
          catalog_product_id: input.catalogProductId,
          catalog_variant_ids: input.catalogVariantIds,
          orientation: input.orientation ?? "vertical",
          placements: input.placements.map((placement) => ({
            placement: placement.placement,
            technique: placement.technique,
            print_area_type: placement.printAreaType,
            layers: [
              {
                type: "file",
                url: placement.imageUrl,
                position: placement.position,
              },
            ],
          })),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Printful mockup task: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    id?: number;
    status?: string;
    data?: Array<{
      id?: number;
      status?: string;
    }>;
  };

  const task = payload.data?.[0];
  const taskId = task?.id ?? payload.id;
  const status = task?.status ?? payload.status;

  if (typeof taskId !== "number" || typeof status !== "string") {
    throw new Error("Printful mockup task response did not include a usable task id and status.");
  }

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    taskId,
    status,
  };
}

export const createPrintfulMockupTaskTool: AgentToolDefinition<
  "create_printful_mockup_task",
  CreatePrintfulMockupTaskInput,
  CreatePrintfulMockupTaskOutput
> = {
  name: "create_printful_mockup_task",
  description: "Create a Printful mockup generation task for draft-mode product creation.",
  stage: "product_creation",
  risk: "medium",
  requiresApproval: true,
  execute: create_printful_mockup_task,
};