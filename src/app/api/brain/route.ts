import { NextRequest, NextResponse } from "next/server";
import { brainGraph, readDoc } from "@/lib/server/brain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("doc");
  if (rel) {
    const doc = readDoc(rel);
    if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ doc: { title: doc.title, content: doc.content, rel: doc.rel } });
  }
  return NextResponse.json(brainGraph());
}
