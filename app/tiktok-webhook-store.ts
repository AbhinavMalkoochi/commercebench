import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

const WEBHOOK_DIRECTORY = path.join(process.cwd(), ".agent-state", "live", "webhooks");

export interface StoredTikTokWebhook {
  id: string;
  receivedAt: string;
  type: string;
  signature?: string;
  payload: Record<string, unknown>;
}

export async function storeTikTokWebhook(
  payload: Record<string, unknown>,
  signature?: string,
): Promise<StoredTikTokWebhook> {
  const receivedAt = new Date().toISOString();
  const webhook: StoredTikTokWebhook = {
    id: `${receivedAt.replace(/[:.]/g, "-")}-${randomUUID()}`,
    receivedAt,
    type: typeof payload.type === "number" ? String(payload.type) : "unknown",
    signature,
    payload,
  };

  await mkdir(WEBHOOK_DIRECTORY, { recursive: true });
  await writeFile(path.join(WEBHOOK_DIRECTORY, `${webhook.id}.json`), JSON.stringify(webhook, null, 2));

  return webhook;
}

export async function readRecentTikTokWebhooks(limit: number): Promise<StoredTikTokWebhook[]> {
  try {
    const files = (await readdir(WEBHOOK_DIRECTORY)).sort().reverse().slice(0, limit);
    const webhooks = await Promise.all(
      files.map(async (file) => {
        const contents = await readFile(path.join(WEBHOOK_DIRECTORY, file), "utf8");
        return JSON.parse(contents) as StoredTikTokWebhook;
      }),
    );

    return webhooks;
  } catch {
    return [];
  }
}