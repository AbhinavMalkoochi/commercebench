import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetPrintfulMockupTaskInput,
  GetPrintfulMockupTaskOutput,
  PrintfulMockupAsset,
} from "@/agent/core/tools";

const DEFAULT_PRINTFUL_MOCKUP_TASKS_URL = "https://api.printful.com/v2/mockup-tasks";

function extractAssets(task: {
  catalog_variant_mockups?: Array<{
    catalog_variant_id?: number;
    mockups?: Array<{
      placement?: string;
      display_name?: string;
      technique?: string;
      style_id?: number;
      mockup_url?: string;
    }>;
  }>;
}): PrintfulMockupAsset[] {
  return (task.catalog_variant_mockups ?? []).flatMap((variantMockup) =>
    (variantMockup.mockups ?? [])
      .filter((mockup): mockup is NonNullable<typeof mockup> & { mockup_url: string } => typeof mockup.mockup_url === "string")
      .map((mockup) => ({
        catalogVariantId: variantMockup.catalog_variant_id ?? 0,
        placement: mockup.placement ?? "unknown",
        displayName: mockup.display_name,
        technique: mockup.technique,
        styleId: mockup.style_id,
        mockupUrl: mockup.mockup_url,
      })),
  );
}

function extractFailureReasons(task: {
  failure_reasons?: Array<{
    detail?: string;
    type?: string;
  }>;
}): string[] {
  return (task.failure_reasons ?? []).map((reason) => reason.detail ?? reason.type ?? "Unknown failure");
}

export async function get_printful_mockup_task(
  input: GetPrintfulMockupTaskInput,
  context: AgentToolExecutionContext,
): Promise<GetPrintfulMockupTaskOutput> {
  const baseUrl = input.pageUrl ?? DEFAULT_PRINTFUL_MOCKUP_TASKS_URL;
  const url = new URL(baseUrl);
  url.searchParams.set("id", String(input.taskId));

  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    headers: {
      "user-agent": "commercebench-agent/0.1",
      "X-PF-Store-ID": input.storeId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Printful mockup task: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    id?: number;
    status?: string;
    catalog_variant_mockups?: Array<{
      catalog_variant_id?: number;
      mockups?: Array<{
        placement?: string;
        display_name?: string;
        technique?: string;
        style_id?: number;
        mockup_url?: string;
      }>;
    }>;
    failure_reasons?: Array<{
      detail?: string;
      type?: string;
    }>;
    data?: Array<{
      id?: number;
      status?: string;
      catalog_variant_mockups?: Array<{
        catalog_variant_id?: number;
        mockups?: Array<{
          placement?: string;
          display_name?: string;
          technique?: string;
          style_id?: number;
          mockup_url?: string;
        }>;
      }>;
      failure_reasons?: Array<{
        detail?: string;
        type?: string;
      }>;
    }>;
  };

  const task = payload.data?.[0] ?? payload;
  const taskId = task.id ?? input.taskId;
  const status = task.status ?? "unknown";

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    taskId,
    status,
    assets: extractAssets(task),
    failureReasons: extractFailureReasons(task),
  };
}

export const getPrintfulMockupTaskTool: AgentToolDefinition<
  "get_printful_mockup_task",
  GetPrintfulMockupTaskInput,
  GetPrintfulMockupTaskOutput
> = {
  name: "get_printful_mockup_task",
  description: "Poll a Printful mockup task and return normalized mockup assets.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: get_printful_mockup_task,
};