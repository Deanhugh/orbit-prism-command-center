import { NextRequest, NextResponse } from "next/server";
import {
  createPost,
  listChannels,
  listPosts,
  socialStatus,
  socialSummary,
} from "@/lib/server/trypost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate read for the Marketing board.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, summary, channels, posts] = await Promise.all([
    socialStatus(),
    socialSummary(),
    listChannels(),
    listPosts({ status: q.get("status") || undefined, search: q.get("search") || undefined, limit: 500 }),
  ]);
  return NextResponse.json({ status, summary, channels, posts });
}

// Create a post.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const content = String(body.content || "").trim();
  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 });
  const post = await createPost({
    content,
    platforms: Array.isArray(body.platforms) ? body.platforms.map(String) : undefined,
    status: body.status ? String(body.status) : undefined,
    scheduledAt: body.scheduledAt ? String(body.scheduledAt) : null,
  });
  return NextResponse.json({ post }, { status: 201 });
}
