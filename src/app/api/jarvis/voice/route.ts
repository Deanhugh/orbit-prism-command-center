import { NextRequest, NextResponse } from "next/server";
import { fishStatus, saveFishApiKey, saveFishVoiceConfig, type FishTtsModel } from "@/lib/server/fish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search") || undefined;
  const status = await fishStatus(search);
  return NextResponse.json(status);
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.apiKey === "string") {
    saveFishApiKey(body.apiKey);
  }
  const patch: { referenceId?: string; title?: string; model?: FishTtsModel } = {};
  if (typeof body.referenceId === "string") patch.referenceId = body.referenceId;
  if (typeof body.title === "string") patch.title = body.title;
  if (body.model === "s2.1-pro" || body.model === "s2.1-pro-free" || body.model === "s2-pro") {
    patch.model = body.model;
  }
  if (Object.keys(patch).length) saveFishVoiceConfig(patch);
  const search = typeof body.search === "string" ? body.search : undefined;
  const status = await fishStatus(search);
  return NextResponse.json({ ok: true, ...status });
}
