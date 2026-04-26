import {
  PrintfulDraftInspectionResult,
  PrintfulProductFamily,
  ProductCreationDraft,
} from "@/agent/core/types";
import { ToolExecutor } from "@/agent/core/tool-executor";
import { DefaultToolPolicy } from "@/agent/core/tool-policy";
import { createDefaultToolRegistry } from "@/agent/core/tool-registry";
import { AgentToolExecutionContext } from "@/agent/core/tools";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";

const PRINTFUL_CATEGORY_BY_FAMILY: Partial<Record<PrintfulProductFamily, number>> = {
  tshirt: 24,
};

export class PrintfulDraftInspector {
  private readonly executor: ToolExecutor;
  private readonly policy = new DefaultToolPolicy();

  constructor(trace?: FileResearchTrace) {
    this.executor = new ToolExecutor(createDefaultToolRegistry(), trace);
  }

  async inspectDraft(
    draft: ProductCreationDraft,
    input: {
      storeId: string;
      toolContext: AgentToolExecutionContext;
    },
  ): Promise<PrintfulDraftInspectionResult> {
    if (draft.blueprint.provider !== "printful") {
      return {
        status: "skipped",
        reasoning: "The draft is not a Printful draft, so Printful inspection was skipped.",
      };
    }

    const productTool = this.executor.getToolDefinition("get_printful_products");
    const priceTool = this.executor.getToolDefinition("get_printful_variant_prices");
    const policyContext = { stage: "product_creation" as const };

    for (const tool of [productTool, priceTool]) {
      const decision = this.policy.evaluate(tool, policyContext);

      if (!decision.allowed) {
        return {
          status: "blocked",
          reasoning: decision.reason,
        };
      }
    }

    const categoryId = PRINTFUL_CATEGORY_BY_FAMILY[draft.blueprint.productFamily];
    const products = await this.executor.execute(
      "get_printful_products",
      {
        categoryId,
      },
      input.toolContext,
    );

    const selectedProduct = products.products.find((product) => product.variants.length > 0);
    const selectedVariant = selectedProduct?.variants[0];

    if (!selectedProduct || !selectedVariant) {
      return {
        status: "blocked",
        reasoning: `No Printful catalog product with variants was found for family ${draft.blueprint.productFamily}.`,
      };
    }

    const pricing = await this.executor.execute(
      "get_printful_variant_prices",
      {
        variantId: selectedVariant.id,
        storeId: input.storeId,
        currency: draft.pricing.currency,
      },
      input.toolContext,
    );

    if (pricing.price > draft.pricing.maxUnitCost) {
      return {
        status: "blocked",
        reasoning: `The selected Printful variant costs ${pricing.price} ${pricing.currency}, which is above the draft max unit cost of ${draft.pricing.maxUnitCost} ${draft.pricing.currency}.`,
      };
      }

    return {
      status: "ready",
      reasoning: `Matched the draft to Printful product ${selectedProduct.name} and variant ${selectedVariant.name} within the target cost envelope.`,
      selection: {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        variantId: selectedVariant.id,
        variantName: selectedVariant.name,
        unitPrice: pricing.price,
        currency: pricing.currency,
        productSourceUrl: products.sourceUrl,
        pricingSourceUrl: pricing.sourceUrl,
      },
    };
  }
}