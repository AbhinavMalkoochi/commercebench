import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  CreatePrintfulStoreProductInput,
  CreatePrintfulStoreProductOutput,
} from "@/agent/core/tools";

const DEFAULT_PRINTFUL_STORE_PRODUCTS_URL = "https://api.printful.com/store/products";

export async function create_printful_store_product(
  input: CreatePrintfulStoreProductInput,
  context: AgentToolExecutionContext,
): Promise<CreatePrintfulStoreProductOutput> {
  const url = input.pageUrl ?? DEFAULT_PRINTFUL_STORE_PRODUCTS_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "commercebench-agent/0.1",
      "X-PF-Store-ID": input.storeId,
    },
    body: JSON.stringify({
      sync_product: {
        external_id: input.externalProductId,
        name: input.name,
        thumbnail: input.thumbnailUrl ?? input.artworkUrl,
        is_ignored: false,
      },
      sync_variants: [
        {
          external_id: input.externalVariantId,
          variant_id: input.variantId,
          retail_price: input.retailPrice.toFixed(2),
          sku: input.sku,
          files: [
            {
              type: "default",
              url: input.artworkUrl,
              filename: input.artworkUrl.split("/").pop() ?? "design.png",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create Printful store product: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    result?: {
      id?: number;
      external_id?: string;
      name?: string;
      variants?: number;
      synced?: number;
      thumbnail_url?: string;
    };
  };

  const result = payload.result;

  if (!result || typeof result.id !== "number" || typeof result.external_id !== "string" || typeof result.name !== "string") {
    throw new Error("Printful store product response did not include a usable draft product result.");
  }

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url,
    productId: result.id,
    externalProductId: result.external_id,
    name: result.name,
    variantCount: result.variants ?? 0,
    syncedCount: result.synced ?? 0,
    thumbnailUrl: result.thumbnail_url,
  };
}

export const createPrintfulStoreProductTool: AgentToolDefinition<
  "create_printful_store_product",
  CreatePrintfulStoreProductInput,
  CreatePrintfulStoreProductOutput
> = {
  name: "create_printful_store_product",
  description: "Create a Printful store-product draft from a selected catalog variant and design file.",
  stage: "product_creation",
  risk: "medium",
  requiresApproval: true,
  execute: create_printful_store_product,
};