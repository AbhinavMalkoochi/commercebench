import { randomUUID } from "node:crypto";
import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

function sanitizeSegment(value: string): string {
  return value.replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "item";
}

export class FileResearchTrace {
  readonly traceId: string;
  readonly traceDirectory: string;
  private readonly eventsPath: string;

  constructor(baseDirectory: string, now = new Date()) {
    this.traceId = `${now.toISOString().replace(/[:.]/g, "-")}-${randomUUID()}`;
    this.traceDirectory = path.join(baseDirectory, this.traceId);
    this.eventsPath = path.join(this.traceDirectory, "events.ndjson");
  }

  async initialize(metadata: Record<string, unknown>): Promise<void> {
    await mkdir(this.traceDirectory, { recursive: true });
    await this.writeJson("metadata.json", metadata);
    await this.recordEvent("trace_initialized", metadata);
  }

  async recordEvent(type: string, payload: Record<string, unknown>): Promise<void> {
    await mkdir(this.traceDirectory, { recursive: true });
    await appendFile(
      this.eventsPath,
      `${JSON.stringify({ timestamp: new Date().toISOString(), type, payload })}\n`,
    );
  }

  async writeJson(relativePath: string, value: unknown): Promise<void> {
    const destination = path.join(this.traceDirectory, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, JSON.stringify(value, null, 2));
  }

  async writeText(relativePath: string, value: string): Promise<void> {
    const destination = path.join(this.traceDirectory, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, value);
  }

  htmlBaseName(url: string): string {
    return sanitizeSegment(url.replace(/^https?:\/\//, ""));
  }

  queryBaseName(queryId: string): string {
    return sanitizeSegment(queryId);
  }
}