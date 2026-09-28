import { NextRequest, NextResponse } from "next/server";
import { addComment, checkoutIssue, updateIssue } from "@/lib/server/paperclip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  if (body.checkout) {
    const issue = await checkoutIssue(id, body.agentId ? String(body.agentId) : undefined);
    if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ issue });
  }
  if (typeof body.comment === "string" && !body.status && !body.title && !body.priority) {
    const result = await addComment(id, body.comment);
    if (!result.ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ ok: true, commentId: result.id });
  }
  const issue = await updateIssue(id, {
    title: body.title !== undefined ? String(body.title) : undefined,
    priority: body.priority !== undefined ? String(body.priority) : undefined,
    status: body.status !== undefined ? String(body.status) : undefined,
    assignee: body.assignee !== undefined ? String(body.assignee) : undefined,
    comment: body.comment !== undefined ? String(body.comment) : undefined,
  });
  if (!issue) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ issue });
}
