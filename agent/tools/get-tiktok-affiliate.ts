import { load } from "cheerio";

import {
  AgentAffiliateProfile,
  AgentToolDefinition,
  AgentToolExecutionContext,
  GetTikTokAffiliateInput,
  GetTikTokAffiliateOutput,
} from "@/agent/core/tools";

const DEFAULT_TIKTOK_AFFILIATE_URL = "https://affiliate-us.tiktok.com/connection/creator";

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeProfileUrl(href: string | undefined, sourceUrl: string): string | undefined {
  if (!href) {
    return undefined;
  }

  try {
    return new URL(href, sourceUrl).toString();
  } catch {
    return undefined;
  }
}

function parseHandle(text: string, href: string | undefined): string | undefined {
  const textMatch = text.match(/@[a-z0-9._-]+/i);

  if (textMatch) {
    return textMatch[0].toLowerCase();
  }

  const hrefMatch = href?.match(/@([a-z0-9._-]+)/i);

  if (hrefMatch) {
    return `@${hrefMatch[1].toLowerCase()}`;
  }

  return undefined;
}

function parseFollowerCount(text: string): string | undefined {
  const match = text.match(/\b\d+(?:[.,]\d+)?\s*(?:k|m|b)?\s+followers?\b/i);
  return match ? normalizeWhitespace(match[0]) : undefined;
}

function parseCategory(text: string): string | undefined {
  const match = text.match(/\b(?:beauty|fashion|fitness|gaming|home|kitchen|pet|tech|travel|wellness)\b/i);
  return match ? match[0].toLowerCase() : undefined;
}

function buildAffiliateProfile(text: string, href: string | undefined, sourceUrl: string): AgentAffiliateProfile | undefined {
  const normalizedText = normalizeWhitespace(text);
  const handle = parseHandle(normalizedText, href);

  if (!handle) {
    return undefined;
  }

  const displayName = normalizedText
    .replace(handle, "")
    .replace(/\b\d+(?:[.,]\d+)?\s*(?:k|m|b)?\s+followers?\b/i, "")
    .trim() || undefined;

  return {
    handle,
    displayName,
    category: parseCategory(normalizedText),
    followerCountText: parseFollowerCount(normalizedText),
    profileUrl: normalizeProfileUrl(href, sourceUrl),
    rawText: normalizedText,
  };
}

function extractAffiliatesFromHtml(html: string, sourceUrl: string, limit: number): AgentAffiliateProfile[] {
  const $ = load(html);
  const candidates: AgentAffiliateProfile[] = [];
  const seenHandles = new Set<string>();

  $("a, article, li, div").each((_, element) => {
    if (candidates.length >= limit) {
      return false;
    }

    const node = $(element);
    const text = normalizeWhitespace(node.text());

    if (!text.includes("@")) {
      return undefined;
    }

    const href = node.is("a") ? node.attr("href") : node.find("a").first().attr("href");
    const profile = buildAffiliateProfile(text, href, sourceUrl);

    if (!profile || seenHandles.has(profile.handle)) {
      return undefined;
    }

    seenHandles.add(profile.handle);
    candidates.push(profile);
    return undefined;
  });

  return candidates;
}

async function readHtml(input: GetTikTokAffiliateInput, context: AgentToolExecutionContext): Promise<{ html: string; sourceUrl: string; notes: string[] }> {
  if (input.html) {
    return {
      html: input.html,
      sourceUrl: input.pageUrl ?? DEFAULT_TIKTOK_AFFILIATE_URL,
      notes: ["Used provided HTML instead of a live fetch."],
    };
  }

  const sourceUrl = input.pageUrl ?? DEFAULT_TIKTOK_AFFILIATE_URL;
  const fetchImpl = context.fetchImpl ?? fetch;
  const response = await fetchImpl(sourceUrl, {
    headers: {
      "user-agent": "commercebench-agent/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch TikTok affiliate page: ${response.status} ${response.statusText}`);
  }

  return {
    html: await response.text(),
    sourceUrl,
    notes: ["Fetched live TikTok affiliate HTML."],
  };
}

export async function get_tiktok_affiliate(
  input: GetTikTokAffiliateInput,
  context: AgentToolExecutionContext,
): Promise<GetTikTokAffiliateOutput> {
  const limit = Math.max(1, Math.min(input.limit ?? 10, 25));
  const { html, sourceUrl, notes } = await readHtml(input, context);
  const affiliates = extractAffiliatesFromHtml(html, sourceUrl, limit);

  return {
    query: input.query,
    sourceUrl,
    fetchedAt: context.now.toISOString(),
    affiliates,
    notes: [
      ...notes,
      `Extracted ${affiliates.length} affiliate profiles for query '${input.query}'.`,
      input.region ? `Requested region: ${input.region}.` : "No region override was provided.",
    ],
  };
}

export const get_tiktok_affilaite = get_tiktok_affiliate;

export const getTikTokAffiliateTool: AgentToolDefinition<
  "get_tiktok_affiliate",
  GetTikTokAffiliateInput,
  GetTikTokAffiliateOutput
> = {
  name: "get_tiktok_affiliate",
  description: "Fetch TikTok affiliate discovery surfaces and return normalized affiliate profiles.",
  stage: "marketing",
  risk: "low",
  requiresApproval: false,
  execute: get_tiktok_affiliate,
};