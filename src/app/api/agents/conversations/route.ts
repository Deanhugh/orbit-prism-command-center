import { NextRequest, NextResponse } from "next/server";
import { clearConversation, conversationById, conversationsWithPreviews, getMessages } from "@/lib/server/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    return NextResponse.json({ messages: getMessages(id) });
  }
  return NextResponse.json({ conversations: conversationsWithPreviews() });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || req.nextUrl.searchParams.get("id") || "").trim();
  if (!id || !conversationById(id)) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }
  clearConversation(id);
  return NextResponse.json({
    ok: true,
    messages: [],
    conversations: conversationsWithPreviews(),
  });
}
