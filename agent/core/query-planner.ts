import { QueryPlan } from "@/agent/core/types";

function formatMonthYear(now: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(now);
}

export function buildResearchQueryPlan(now: Date): QueryPlan[] {
  const monthYear = formatMonthYear(now);

  return [
    {
      id: "query-tiktok-products",
      sourceId: "tiktok_creative_center",
      query: `tiktok shop trending products ${monthYear}`,
      allowedDomains: ["ads.tiktok.com", "tiktok.com"],
    },
    {
      id: "query-tiktok-creators",
      sourceId: "tiktok_creator_search",
      query: `what creators are posting on tiktok this week ${monthYear} for products and ecommerce`,
      allowedDomains: ["tiktok.com", "ads.tiktok.com"],
    },
    {
      id: "query-tiktok-hashtags",
      sourceId: "tiktok_hashtag_search",
      query: `tiktok trending product hashtags ${monthYear}`,
      allowedDomains: ["ads.tiktok.com", "tiktok.com", "shopify.com"],
    },
    {
      id: "query-shopify-products",
      sourceId: "shopify_tiktok_products",
      query: `shopify top tiktok products ${monthYear}`,
      allowedDomains: ["shopify.com"],
    },
    {
      id: "query-shopify-trends",
      sourceId: "shopify_tiktok_trends",
      query: `shopify tiktok trends ${monthYear}`,
      allowedDomains: ["shopify.com"],
    },
    {
      id: "query-cj-winners",
      sourceId: "cj_winning_products",
      query: `cjdropshipping winning products ${monthYear}`,
      allowedDomains: ["cjdropshipping.com"],
    },
    {
      id: "query-cj-tiktok",
      sourceId: "cj_tiktok_products",
      query: `cjdropshipping tiktok viral products ${monthYear}`,
      allowedDomains: ["cjdropshipping.com"],
    },
    {
      id: "query-pinterest-predicts",
      sourceId: "pinterest_predicts",
      query: `pinterest predicts shopping trends ${monthYear}`,
      allowedDomains: ["business.pinterest.com", "pinterest.com"],
    },
  ];
}