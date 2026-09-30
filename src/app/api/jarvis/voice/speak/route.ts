import { NextRequest, NextResponse } from "next/server";
import { synthesizeFish } from "@/lib/server/fish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").trim();
  if (!text) {
    return NextResponse.json({ fallback: true, reason: "empty text" }, { status: 400 });
  }
  const result = await synthesizeFish(text);
  if (!result.ok) {
    const status = result.reason === "no Fish API key" || result.reason === "empty text" ? 200 : 503;
    return NextResponse.json({ fallback: true, reason: result.reason }, { status });
  }
  return new NextResponse(new Uint8Array(result.audio), {
    status: 200,
    headers: {
      "Content-Type": result.contentType,
      "Cache-Control": "no-store",
    },
  });
}
