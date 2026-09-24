import { NextRequest, NextResponse } from "next/server";
import { jarvisRoute } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const instruction = String(body.instruction || "").trim();
  if (!instruction) {
    return NextResponse.json({ error: "instruction required" }, { status: 400 });
  }
  const result = await jarvisRoute(instruction);
  return NextResponse.json(result);
}
