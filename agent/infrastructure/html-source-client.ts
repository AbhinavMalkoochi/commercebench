import { load } from "cheerio";

import { HtmlSourceClient, SourceDocument } from "@/agent/core/types";
import { withRetries } from "@/agent/infrastructure/retry";

function extractStructuredText(html: string): string {
  const $ = load(html);
  const lines: string[] = [];

  $("h1, h2, h3, h4, p, li").each((_, element) => {
    const line = $(element).text().replace(/\s+/g, " ").trim();

    if (line.length > 0) {
      lines.push(line);
    }
  });

  return lines.join("\n");
}

export class LiveHtmlSourceClient implements HtmlSourceClient {
  async fetchDocument(url: string): Promise<SourceDocument> {
    return withRetries(async () => {
      const response = await fetch(url, {
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; CommercebenchResearchBot/0.1; +https://github.com/AbhinavMalkoochi/commercebench)",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
      }

      const html = await response.text();

      return {
        url,
        html,
        text: extractStructuredText(html),
        fetchedAt: new Date().toISOString(),
      };
    });
  }
}

export class FixtureHtmlSourceClient implements HtmlSourceClient {
  constructor(private readonly documents: Record<string, string>) {}

  async fetchDocument(url: string): Promise<SourceDocument> {
    const html = this.documents[url];

    if (!html) {
      throw new Error(`Missing fixture document for ${url}`);
    }

    return {
      url,
      html,
      text: extractStructuredText(html),
      fetchedAt: new Date().toISOString(),
    };
  }
}