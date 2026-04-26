import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CjProductSummary,
  QueryCjProductsInput,
  QueryCjProductsOutput,
} from "@/agent/core/tools";

const DEFAULT_CJ_PRODUCTS_QUERY_URL = "https://developers.cjdropshipping.com/api2.0/v1/product/query";

function parseCjProduct(product: Record<string, unknown>): CjProductSummary {
  return {
    productId: typeof product.product_id === "string" ? product.product_id : String(product.pid ?? ""),
    name: typeof product.name === "string" ? product.name : "Unknown CJ product",
    sku: typeof product.sku === "string" ? product.sku : undefined,
    price: typeof product.price === "number" ? product.price : undefined,
  };
}

export async function query_cj_products(
  input: QueryCjProductsInput,
  context: AgentToolExecutionContext,
): Promise<QueryCjProductsOutput> {
  const url = new URL(input.pageUrl ?? DEFAULT_CJ_PRODUCTS_QUERY_URL);
  url.searchParams.set("access_token", input.accessToken);

  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
    },
    body: JSON.stringify({
      query_params: {
        name: input.name,
        sku: input.sku,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to query CJ products: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    products?: Array<Record<string, unknown>>;
    data?: Array<Record<string, unknown>>;
  };
  const products = (payload.products ?? payload.data ?? []).map(parseCjProduct);

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    products,
  };
}

export const queryCjProductsTool: AgentToolDefinition<
  "query_cj_products",
  QueryCjProductsInput,
  QueryCjProductsOutput
> = {
  name: "query_cj_products",
  description: "Query CJ Dropshipping products by keyword or SKU for sourced-product planning.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: query_cj_products,
};