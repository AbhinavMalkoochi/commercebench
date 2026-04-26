import {
  CandidatePortfolioEntry,
  CjDropshippingProductBlueprint,
  PriceBand,
  PrintfulProductBlueprint,
  PrintfulProductFamily,
  ProductCreationDraft,
  ProductCreationRequest,
  ProductCreationResult,
} from "@/agent/core/types";

const PRINTFUL_RULES: Array<{ family: PrintfulProductFamily; keywords: string[] }> = [
  { family: "tshirt", keywords: ["shirt", "t-shirt", "tee", "tees", "graphictee", "apparel"] },
  { family: "hoodie", keywords: ["hoodie", "sweatshirt"] },
  { family: "poster", keywords: ["poster", "wall art", "print", "decor"] },
  { family: "mug", keywords: ["mug", "cup", "drinkware"] },
  { family: "tote", keywords: ["tote", "bag"] },
  { family: "phone_case", keywords: ["phone case", "iphonecase", "screen protector", "stickers"] },
];

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function getCombinedText(candidate: CandidatePortfolioEntry): string {
  return `${candidate.label} ${candidate.tags.join(" ")}`.toLowerCase();
}

function choosePrintfulFamily(candidate: CandidatePortfolioEntry): PrintfulProductFamily | undefined {
  const combined = getCombinedText(candidate);

  return PRINTFUL_RULES.find((rule) => rule.keywords.some((keyword) => combined.includes(keyword)))?.family;
}

function collectObservedPrices(candidate: CandidatePortfolioEntry): number[] {
  return candidate.evidence.flatMap((signal) => {
    const priceBand = signal.priceBand as PriceBand | undefined;

    if (!priceBand) {
      return [];
    }

    const values = [priceBand.min, priceBand.max].filter((value): value is number => typeof value === "number");
    return values;
  });
}

function buildPricingEnvelope(request: ProductCreationRequest) {
  const observedPrices = collectObservedPrices(request.candidate);
  const observedAnchor =
    observedPrices.length > 0
      ? observedPrices.reduce((sum, value) => sum + value, 0) / observedPrices.length
      : 24;
  const targetRetailPrice = Number(
    clamp(Math.round(observedAnchor), 12, request.maxRetailPrice).toFixed(2),
  );
  const maxUnitCost = Number((targetRetailPrice * (1 - request.targetMarginFloor)).toFixed(2));

  return {
    currency: "USD" as const,
    targetRetailPrice,
    maxUnitCost,
    compareAtPrice: Number((targetRetailPrice * 1.25).toFixed(2)),
  };
}

function buildHeadline(candidate: CandidatePortfolioEntry): string {
  return `${candidate.label} launch draft`;
}

function buildPrintfulBlueprint(
  candidate: CandidatePortfolioEntry,
  family: PrintfulProductFamily,
): PrintfulProductBlueprint {
  return {
    provider: "printful",
    productFamily: family,
    requiresGeneratedArtwork: true,
    designBrief: [
      `Create a ${family.replace(/_/g, " ")} concept inspired by ${candidate.label}.`,
      `Lean into ${candidate.score.reasons.join(", ")} while keeping the design clean and legible on a product mockup.`,
      `Use a strong visual hook that fits short-form social content and product thumbnail crops.`,
    ].join(" "),
  };
}

function buildCjBlueprint(candidate: CandidatePortfolioEntry): CjDropshippingProductBlueprint {
  return {
    provider: "cj_dropshipping",
    sourcingQuery: `${candidate.label} ${candidate.tags.slice(0, 4).join(" ")}`.trim(),
    searchKeywords: [candidate.label, ...candidate.tags].slice(0, 6),
    sampleOrderRecommended: true,
    requiresManualPaymentApproval: true,
  };
}

function buildDraft(
  request: ProductCreationRequest,
  blueprint: ProductCreationDraft["blueprint"],
): ProductCreationDraft {
  const approvalRequirements = blueprint.provider === "printful"
    ? [
        {
          step: "design_review" as const,
          reason: "Generated artwork and mockups should be approved before publishing.",
        },
        {
          step: "listing_publish" as const,
          reason: "The first listing should be reviewed before it is published live.",
        },
      ]
    : [
        {
          step: "sample_order" as const,
          reason: "A sourced product should be spot-checked or sample-ordered before launch.",
        },
        {
          step: "supplier_payment" as const,
          reason: "Supplier payments must stay human-authorized.",
        },
        {
          step: "listing_publish" as const,
          reason: "The first sourced-product listing should be reviewed before it is published live.",
        },
      ];

  return {
    candidateKey: request.candidate.key,
    candidateLabel: request.candidate.label,
    fulfillmentProvider: blueprint.provider,
    headline: buildHeadline(request.candidate),
    pricing: buildPricingEnvelope(request),
    blueprint,
    approvalRequirements,
    notes: [
      `Primary reasons: ${request.candidate.score.reasons.join(", ") || "fresh demand signal"}.`,
      `Gate passed: ${request.candidate.score.gatePassed}.`,
    ],
  };
}

export function planProductCreation(request: ProductCreationRequest): ProductCreationResult {
  if (!request.candidate.score.gatePassed) {
    return {
      status: "blocked_manual_review",
      reasoning: "The selected candidate did not pass research gates, so product creation stayed blocked.",
    };
  }

  const printfulFamily = choosePrintfulFamily(request.candidate);

  if (printfulFamily) {
    return {
      status: "draft_ready",
      reasoning: "The candidate maps cleanly to a print-on-demand product family, so the kernel produced a Printful-first draft.",
      draft: buildDraft(request, buildPrintfulBlueprint(request.candidate, printfulFamily)),
    };
  }

  return {
    status: "draft_ready",
    reasoning: "The candidate is better suited to sourced-product fulfillment, so the kernel produced a CJ-first draft with manual payment approval required.",
    draft: buildDraft(request, buildCjBlueprint(request.candidate)),
  };
}