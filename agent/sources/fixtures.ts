import {
  QueryPlan,
  ResearchSignal,
  SearchProvider,
} from "@/agent/core/types";

const FIXTURE_HTML_DOCUMENTS: Record<string, string> = {
  "https://www.shopify.com/blog/tiktok-products": `
    <article>
      <h1>Top TikTok Trending Products To Sell In 2026</h1>
      <h3>1. Hydrocolloid Pimple Patches</h3>
      <p>Beauty and skincare videos are especially popular for short-form content. This product solves a narrow problem quickly, works in before-and-after demos, and fits fast travel or event prep buying.</p>
      <h3>2. Reusable Water Bottles and Stainless Steel Tumblers</h3>
      <p>Hydration content and wellness routines remain strong, especially for commute, travel, and gym content. Bundles and accessories help pricing.</p>
      <h3>3. Slow-Feeder Dog Bowls</h3>
      <p>Functional pet products solve real owner pain points and perform well with UGC and educational videos.</p>
      <h3>4. Press-On Nails</h3>
      <p>Transformation videos and event-driven beauty make this easy to demonstrate.</p>
    </article>
  `,
  "https://www.shopify.com/blog/tiktok-trends": `
    <article>
      <h1>Top TikTok Trends in 2026</h1>
      <h3>1. Get Ready With Me</h3>
      <p>Routine-led videos continue to drive product discovery.</p>
      <h3>2. #TikTokMadeMeBuyIt</h3>
      <p>Impulse-friendly products that demo quickly still work.</p>
      <h3>3. Pack an Order With Me</h3>
      <p>Creator-friendly fulfillment and visual packaging still matter.</p>
    </article>
  `,
  "https://cjdropshipping.com/blogs/winning-products/Best-Trending-Dropshipping-Products-for-May-2026": `
    <article>
      <h1>Best Trending Dropshipping Products for May 2026</h1>
      <h2>1. Hydrocolloid Pimple Patches</h2>
      <p>This product sits in the sweet spot between trend and evergreen. It works for emergency skincare, event prep, and travel beauty. Competition exists, but the demo is clear and impulse-friendly.</p>
      <h2>2. Reusable Water Bottles and Stainless Steel Tumblers</h2>
      <p>Hydration content remains cultural, especially for commute, travel, and gym reset content. A plain bottle is a commodity, but bundles work.</p>
      <h2>3. Slow-Feeder Dog Bowls and Interactive Pet Feeding Products</h2>
      <p>Functional pet products solve clear pain points and work well for educational video content.</p>
      <h2>4. Press-On Nails and At-Home Nail Kits</h2>
      <p>Immediate transformation and event-driven beauty make this a strong visual category.</p>
    </article>
  `,
  "https://cjdropshipping.com/blogs/winning-products/TikTok-Viral-products-2026": `
    <article>
      <h1>Best 20 TikTok Viral products 2026</h1>
      <h2>1. Hydrocolloid Pimple Patches</h2>
      <p>Before-and-after routines, quick visible results, and creator demos make this format easy to scale on TikTok.</p>
      <h2>2. Scalp Serums and Applicator Tools</h2>
      <p>Routine content and hair health education drive repeat creator interest.</p>
      <h2>3. Reusable Water Bottle Bags</h2>
      <p>Portable, visual, and easy to bundle for lifestyle content.</p>
    </article>
  `,
  "https://business.pinterest.com/pinterest-predicts/": `
    <article>
      <h1>Pinterest Predicts</h1>
      <p>Explore the trends</p>
      <p>Scent Stacking</p>
      <p>Cool Blue</p>
      <p>Gimme Gummy</p>
      <p>Pen Pals</p>
      <p>Download report</p>
    </article>
  `,
};

function fixtureSignal(
  query: QueryPlan,
  index: number,
  input: {
    label: string;
    summary: string;
    tags: string[];
    freshness: number;
    visualDemo: number;
    creatorAppeal: number;
    purchaseIntent: number;
    priceFit: number;
    saturationResistance: number;
    seasonality: number;
    confidence: number;
    sourceUrl?: string;
    priceMax?: number;
  },
): ResearchSignal {
  return {
    id: `${query.id}-fixture-${index}`,
    kind: "candidate",
    sourceId: query.sourceId,
    queryId: query.id,
    query: query.query,
    sourceMode: "search_backed",
    sourceUrl: input.sourceUrl,
    label: input.label,
    summary: input.summary,
    tags: input.tags,
    metrics: {
      freshness: input.freshness,
      visualDemo: input.visualDemo,
      creatorAppeal: input.creatorAppeal,
      purchaseIntent: input.purchaseIntent,
      priceFit: input.priceFit,
      saturationResistance: input.saturationResistance,
      seasonality: input.seasonality,
      sourceAuthority: 0.95,
    },
    confidence: input.confidence,
    priceBand: input.priceMax
      ? {
          currency: "USD",
          max: input.priceMax,
        }
      : undefined,
    detectedAt: new Date().toISOString(),
  };
}

export class FixtureSearchProvider implements SearchProvider {
  async searchSignals(plan: QueryPlan): Promise<ResearchSignal[]> {
    switch (plan.sourceId) {
      case "tiktok_creative_center":
        return [
          fixtureSignal(plan, 1, {
            label: "Hydrocolloid Pimple Patches",
            summary: "Creators are posting fast before-and-after skincare clips and makeup-bag routines around pimple patches.",
            tags: ["skincare", "beauty", "routine", "travel"],
            freshness: 0.94,
            visualDemo: 0.95,
            creatorAppeal: 0.9,
            purchaseIntent: 0.88,
            priceFit: 0.96,
            saturationResistance: 0.56,
            seasonality: 0.82,
            confidence: 0.92,
            priceMax: 18,
            sourceUrl: "https://ads.tiktok.com/business/creativecenter/top-products/pc/en",
          }),
          fixtureSignal(plan, 2, {
            label: "Reusable Water Bottles",
            summary: "Hydration content still performs, but the category is crowded unless the product has a niche angle or bundle.",
            tags: ["hydration", "wellness", "travel", "gym"],
            freshness: 0.9,
            visualDemo: 0.8,
            creatorAppeal: 0.74,
            purchaseIntent: 0.78,
            priceFit: 0.85,
            saturationResistance: 0.38,
            seasonality: 0.84,
            confidence: 0.82,
            priceMax: 35,
          }),
        ];
      case "tiktok_creator_search":
        return [
          fixtureSignal(plan, 1, {
            label: "Hydrocolloid Pimple Patches",
            summary: "Small creators are using pimple patches inside GRWM and event-prep content because the product demo is instant.",
            tags: ["grwm", "skincare", "beauty", "event"],
            freshness: 0.93,
            visualDemo: 0.93,
            creatorAppeal: 0.91,
            purchaseIntent: 0.83,
            priceFit: 0.96,
            saturationResistance: 0.57,
            seasonality: 0.84,
            confidence: 0.9,
            priceMax: 18,
          }),
          fixtureSignal(plan, 2, {
            label: "Scalp Serum Applicator Tools",
            summary: "Routine-led hair growth content is active, but the category needs more education than quick-fix skincare.",
            tags: ["hair", "routine", "scalp", "beauty"],
            freshness: 0.89,
            visualDemo: 0.79,
            creatorAppeal: 0.84,
            purchaseIntent: 0.71,
            priceFit: 0.81,
            saturationResistance: 0.64,
            seasonality: 0.72,
            confidence: 0.84,
            priceMax: 29,
          }),
        ];
      case "tiktok_hashtag_search":
        return [
          fixtureSignal(plan, 1, {
            label: "Hydrocolloid Pimple Patches",
            summary: "Hashtag clusters around makeup bag, overnight fix, and wedding or graduation prep make pimple patches highly reusable in content.",
            tags: ["overnight", "skincare", "graduation", "wedding"],
            freshness: 0.95,
            visualDemo: 0.92,
            creatorAppeal: 0.89,
            purchaseIntent: 0.85,
            priceFit: 0.96,
            saturationResistance: 0.55,
            seasonality: 0.86,
            confidence: 0.91,
            priceMax: 18,
          }),
          fixtureSignal(plan, 2, {
            label: "Slow-Feeder Dog Bowls",
            summary: "Pet owners are sharing functional pet routine content, but volume is lower than beauty and event-prep niches.",
            tags: ["pet", "routine", "dog", "functional"],
            freshness: 0.86,
            visualDemo: 0.74,
            creatorAppeal: 0.7,
            purchaseIntent: 0.79,
            priceFit: 0.87,
            saturationResistance: 0.68,
            seasonality: 0.75,
            confidence: 0.81,
            priceMax: 28,
          }),
        ];
      default:
        return [];
    }
  }
}

export function getFixtureHtmlDocuments(): Record<string, string> {
  return FIXTURE_HTML_DOCUMENTS;
}