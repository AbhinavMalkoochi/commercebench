import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetPrintfulProductsInput,
  GetPrintfulProductsOutput,
  PrintfulCatalogProduct,
} from "@/agent/core/tools";

const DEFAULT_PRINTFUL_PRODUCTS_URL = "https://api.printful.com/products";

function parseProduct(product: Record<string, unknown>): PrintfulCatalogProduct {
  return {
    id: Number(product.id),
    name: String(product.name ?? "Unknown product"),
    description: typeof product.description === "string" ? product.description : undefined,
    categoryId: typeof product.category_id === "number" ? product.category_id : undefined,
    variants: Array.isArray(product.variants)
      ? product.variants.map((variant) => {
          const item = variant as Record<string, unknown>;
          return {
            id: Number(item.id),
            name: String(item.name ?? "Unknown variant"),
            price: typeof item.price === "number"
              ? item.price
              : typeof item.price === "string"
                ? Number(item.price)
                : undefined,
          };
        })
      : [],
  };
}

export async function get_printful_products(
  input: GetPrintfulProductsInput,
  context: AgentToolExecutionContext,
): Promise<GetPrintfulProductsOutput> {
  const url = new URL(input.pageUrl ?? DEFAULT_PRINTFUL_PRODUCTS_URL);

  if (typeof input.categoryId === "number") {
    url.searchParams.set("category_id", String(input.categoryId));
  }

  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    headers: {
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Printful products: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as { result?: Array<Record<string, unknown>> };

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    products: Array.isArray(payload.result) ? payload.result.map(parseProduct) : [],
  };
}

export const getPrintfulProductsTool: AgentToolDefinition<
  "get_printful_products",
  GetPrintfulProductsInput,
  GetPrintfulProductsOutput
> = {
  name: "get_printful_products",
  description: "Fetch Printful catalog products with optional category filtering.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: get_printful_products,
};