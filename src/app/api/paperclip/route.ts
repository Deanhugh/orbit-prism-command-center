import { NextRequest, NextResponse } from "next/server";
import {
  createIssue,
  listIssues,
  paperclipStatus,
  paperclipSummary,
} from "@/lib/server/paperclip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, summary, issues] = await Promise.all([
    paperclipStatus(),
    paperclipSummary(),
    listIssues({ status: q.get("status") || undefined, search: q.get("search") || undefined, limit: 500 }),
  ]);
  return NextResponse.json({ status, summary, issues });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || body.name || "").trim();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const issue = await createIssue({
    title,
    description: body.description ? String(body.description) : undefined,
    status: body.status ? String(body.status) : undefined,
    priority: body.priority ? String(body.priority) : undefined,
    assignee: body.assignee ? String(body.assignee) : undefined,
  });
  return NextResponse.json({ issue }, { status: 201 });
}
