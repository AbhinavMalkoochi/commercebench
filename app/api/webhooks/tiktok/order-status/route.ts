import { NextRequest, NextResponse } from "next/server";

import { storeTikTokWebhook } from "@/app/tiktok-webhook-store";

export async function POST(request: NextRequest) {
  const payload = await request.json() as Record<string, unknown>;
  const signature = request.headers.get("authorization") ?? undefined;
  const record = await storeTikTokWebhook(payload, signature);

  return NextResponse.json({ ok: true, id: record.id });
}