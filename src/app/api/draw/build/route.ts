import { NextRequest, NextResponse } from "next/server";
import { buildDrawBoard } from "@/lib/server/draw";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const prompt = String(body.prompt || "").trim();
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });
  const agentId = typeof body.agentId === "string" ? body.agentId : undefined;
  const { board, events } = buildDrawBoard(prompt, agentId);
  if (!board) return NextResponse.json({ error: "could not sketch" }, { status: 400 });
  return NextResponse.json({ board, events });
}
