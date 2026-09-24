import { NextRequest, NextResponse } from "next/server";
import { addMemory, getHive, sendMessage } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const hive = getHive();
  return NextResponse.json(hive);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const kind = body.kind as "message" | "memory";
  if (kind === "message") {
    const from = String(body.from || "you");
    const to = String(body.to || "");
    const text = String(body.body || "").trim();
    if (!to || !text) {
      return NextResponse.json({ error: "to and body required" }, { status: 400 });
    }
    const message = sendMessage(from, to, text);
    return NextResponse.json({ message });
  }
  if (kind === "memory") {
    const agentId = String(body.agentId || "");
    const text = String(body.text || "").trim();
    if (!agentId || !text) {
      return NextResponse.json({ error: "agentId and text required" }, { status: 400 });
    }
    const entry = addMemory(agentId, text);
    return NextResponse.json({ entry });
  }
  return NextResponse.json({ error: "unknown kind" }, { status: 400 });
}
