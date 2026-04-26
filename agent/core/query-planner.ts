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
      id: "query-tiktok-creative-center-products",
      sourceId: "tiktok_creative_center",
      query: `tiktok creative center top products ${monthYear}`,
      allowedDomains: ["ads.tiktok.com"],
      freshnessWindowDays: 21,
    },
    {
      id: "query-tiktok-shop-trending",
      sourceId: "tiktok_shop_search",
      query: `tiktok shop trending products ${monthYear}`,
      allowedDomains: ["shop.tiktok.com", "ads.tiktok.com", "echotik.live"],
      freshnessWindowDays: 21,
    },
    {
      id: "query-tiktok-hashtags",
      sourceId: "tiktok_hashtag_search",
      query: `tiktok trending product hashtags ${monthYear}`,
      allowedDomains: ["ads.tiktok.com", "echotik.live"],
      freshnessWindowDays: 21,
    },
    {
      id: "query-tiktok-made-me-buy-it",
      sourceId: "tiktok_made_me_buy_it_search",
      query: `tiktok made me buy it products ${monthYear}`,
      allowedDomains: ["echotik.live", "ads.tiktok.com", "shop.tiktok.com"],
      freshnessWindowDays: 21,
    },
    {
      id: "query-shopify-products",
      sourceId: "shopify_tiktok_products",
      query: `shopify top tiktok products ${monthYear}`,
      allowedDomains: ["shopify.com"],
      freshnessWindowDays: 35,
    },
    {
      id: "query-shopify-trends",
      sourceId: "shopify_tiktok_trends",
      query: `shopify tiktok trends ${monthYear}`,
      allowedDomains: ["shopify.com"],
      freshnessWindowDays: 35,
    },
    {
      id: "query-cj-winners",
      sourceId: "cj_winning_products",
      query: `cjdropshipping winning products ${monthYear}`,
      allowedDomains: ["cjdropshipping.com"],
      freshnessWindowDays: 35,
    },
    {
      id: "query-cj-tiktok",
      sourceId: "cj_tiktok_products",
      query: `cjdropshipping tiktok viral products ${monthYear}`,
      allowedDomains: ["cjdropshipping.com", "echotik.live"],
      freshnessWindowDays: 35,
    },
  ];
}