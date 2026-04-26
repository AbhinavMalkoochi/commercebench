import {
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetPrintfulVariantPricesInput,
  GetPrintfulVariantPricesOutput,
} from "@/agent/core/tools";

const DEFAULT_PRINTFUL_VARIANT_PRICES_URL = "https://api.printful.com/v2/catalog-variants";

export async function get_printful_variant_prices(
  input: GetPrintfulVariantPricesInput,
  context: AgentToolExecutionContext,
): Promise<GetPrintfulVariantPricesOutput> {
  const baseUrl = input.pageUrl ?? DEFAULT_PRINTFUL_VARIANT_PRICES_URL;
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${input.variantId}/prices`);
  url.searchParams.set("selling_region_name", input.sellingRegionName ?? "worldwide");
  url.searchParams.set("currency", input.currency ?? "USD");

  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(url.toString(), {
    headers: {
      "user-agent": "commercebench-agent/0.1",
      "X-PF-Store-ID": input.storeId,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Printful variant pricing: ${response.status} ${response.statusText}`);
  }

  const payload = (await response.json()) as {
    data?: {
      variant_id?: number;
      price?: number | string;
      currency?: string;
    };
  };

  const priceValue = payload.data?.price;
  const price = typeof priceValue === "number"
    ? priceValue
    : typeof priceValue === "string"
      ? Number(priceValue)
      : Number.NaN;

  if (Number.isNaN(price)) {
    throw new Error("Printful variant pricing response did not include a usable price.");
  }

  return {
    fetchedAt: context.now.toISOString(),
    sourceUrl: url.toString(),
    variantId: payload.data?.variant_id ?? input.variantId,
    currency: payload.data?.currency ?? (input.currency ?? "USD"),
    price,
  };
}

export const getPrintfulVariantPricesTool: AgentToolDefinition<
  "get_printful_variant_prices",
  GetPrintfulVariantPricesInput,
  GetPrintfulVariantPricesOutput
> = {
  name: "get_printful_variant_prices",
  description: "Fetch Printful catalog variant pricing for a specific store, region, and currency.",
  stage: "product_creation",
  risk: "low",
  requiresApproval: false,
  execute: get_printful_variant_prices,
};