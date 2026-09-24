import { NextRequest, NextResponse } from "next/server";
import { listModels } from "@/lib/server/llm";
import { PROVIDER_IDS, type ProviderId } from "@/lib/server/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Return the available models for a given provider (used by the per-agent
// model picker in the Agents chat composer).
export async function GET(req: NextRequest) {
  const provider = req.nextUrl.searchParams.get("provider") as ProviderId | null;
  if (!provider || !PROVIDER_IDS.includes(provider)) {
    return NextResponse.json({ models: [] });
  }
  return NextResponse.json({ models: await listModels(provider) });
}
