import {
  ListingDraftArtifact,
  ListingDraftResult,
  ProductExecutionResult,
  PrintfulDraftExecutionResult,
  ProductCreationDraft,
} from "@/agent/core/types";

function toHandle(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function buildDescription(draft: ProductCreationDraft, execution: PrintfulDraftExecutionResult): string {
  const productName = execution.storeProduct?.name ?? draft.headline;
  const designBrief = draft.blueprint.provider === "printful"
    ? draft.blueprint.designBrief
    : draft.notes[0] ?? draft.headline;

  return [
    `${productName} is a draft listing prepared from a validated commercebench product-creation run.`,
    designBrief,
    `Target retail price is $${draft.pricing.targetRetailPrice.toFixed(2)} with a planned compare-at price of $${(draft.pricing.compareAtPrice ?? draft.pricing.targetRetailPrice).toFixed(2)}.`,
  ].join(" ");
}

export function buildListingDraft(
  draft: ProductCreationDraft,
  execution?: ProductExecutionResult,
): ListingDraftResult {
  if (draft.blueprint.provider !== "printful") {
    return {
      status: "skipped",
      reasoning: "Listing draft generation currently only runs for Printful-backed product drafts.",
    };
  }

  const printfulExecution = execution as PrintfulDraftExecutionResult | undefined;

  if (!printfulExecution?.storeProduct) {
    return {
      status: "blocked",
      reasoning: "Listing draft generation requires a Printful store-product draft artifact.",
    };
  }

  const artifact: ListingDraftArtifact = {
    title: draft.headline,
    subtitle: `${draft.candidateLabel} inspired Printful draft listing`,
    description: buildDescription(draft, printfulExecution),
    bullets: [
      `Prepared from Printful store-product draft ${printfulExecution.storeProduct.productId}.`,
      `Built around ${printfulExecution.selection?.productName ?? "a matched Printful base product"}.`,
      `Uses the validated target retail price of $${draft.pricing.targetRetailPrice.toFixed(2)}.`,
    ],
    tags: [
      draft.candidateKey,
      draft.fulfillmentProvider,
      ...draft.notes.map((note) => note.split(":")[0]?.toLowerCase().replace(/[^a-z0-9]+/g, "-") ?? "note"),
    ].slice(0, 6),
    heroImageUrl: printfulExecution.mockup?.assets[0]?.mockupUrl ?? printfulExecution.storeProduct.thumbnailUrl,
    productHandle: toHandle(`${draft.candidateKey}-${printfulExecution.storeProduct.productId}`),
    retailPrice: draft.pricing.targetRetailPrice,
    compareAtPrice: draft.pricing.compareAtPrice,
  };

  return {
    status: "ready",
    reasoning: `Prepared a local listing draft from Printful store-product draft ${printfulExecution.storeProduct.productId} without publishing it live.`,
    artifact,
  };
}