import { NextRequest, NextResponse } from "next/server";
import { updatePost } from "@/lib/server/trypost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const post = await updatePost(id, {
    content: body.content !== undefined ? String(body.content) : undefined,
    status: body.status !== undefined ? String(body.status) : undefined,
    scheduledAt: body.scheduledAt !== undefined ? String(body.scheduledAt) : undefined,
  });
  if (!post) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ post });
}
