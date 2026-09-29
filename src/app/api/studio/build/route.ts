import { NextRequest, NextResponse } from "next/server";
import { buildStudioProduction } from "@/lib/server/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  const agentId = typeof body.agentId === "string" ? body.agentId : undefined;
  const { model, events } = buildStudioProduction(prompt, agentId);
  if (!model) return NextResponse.json({ error: "could not produce" }, { status: 400 });
  return NextResponse.json({ model, events });
}
