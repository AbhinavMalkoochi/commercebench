import path from "node:path";
import { load } from "cheerio";

import { HtmlSourceClient, SourceDocument } from "@/agent/core/types";
import { FileResearchTrace } from "@/agent/infrastructure/file-research-trace";
import { withRetries } from "@/agent/infrastructure/retry";

function extractStructuredText(html: string): string {
  const $ = load(html);
  const seen = new Set<string>();
  const lines: string[] = [];

  $("script, style, noscript, svg, header, footer, nav, aside, form").remove();

  const article = $("article").first();
  const main = $("main").first();
  const root = article.length > 0 ? article : main.length > 0 ? main : $("body");

  root.find("h1, h2, h3, h4, p, li").each((_, element) => {
    const line = $(element).text().replace(/\s+/g, " ").trim();

    if (line.length > 0 && !seen.has(line)) {
      seen.add(line);
      lines.push(line);
    }
  });

  return lines.join("\n");
}

export class LiveHtmlSourceClient implements HtmlSourceClient {
  constructor(private readonly trace?: FileResearchTrace) {}

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
      const text = extractStructuredText(html);

      if (this.trace) {
        const baseName = this.trace.htmlBaseName(url);
        await Promise.all([
          this.trace.writeText(path.join("html", `${baseName}.html`), html),
          this.trace.writeText(path.join("html", `${baseName}.txt`), text),
          this.trace.recordEvent("html_fetched", {
            url,
            baseName,
            htmlBytes: html.length,
            textBytes: text.length,
          }),
        ]);
      }

      return {
        url,
        html,
        text,
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