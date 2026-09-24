import { NextRequest, NextResponse } from "next/server";
import { conversationsWithPreviews, getMessages } from "@/lib/server/conversations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (id) {
    return NextResponse.json({ messages: getMessages(id) });
  }
  return NextResponse.json({ conversations: conversationsWithPreviews() });
}
