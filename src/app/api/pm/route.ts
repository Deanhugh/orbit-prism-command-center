import { NextRequest, NextResponse } from "next/server";
import {
  createWorkItem,
  listProjects,
  listWorkItems,
  planeStatus,
  pmSummary,
} from "@/lib/server/plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate read for the PMO board.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, summary, projects, workItems] = await Promise.all([
    planeStatus(),
    pmSummary(),
    listProjects(),
    listWorkItems({ projectId: q.get("projectId") || undefined, search: q.get("search") || undefined, limit: 500 }),
  ]);
  return NextResponse.json({ status, summary, projects, workItems });
}

// Create a work item.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const workItem = await createWorkItem({
    name,
    projectId: body.projectId ? String(body.projectId) : undefined,
    description: body.description ? String(body.description) : undefined,
    priority: body.priority ? String(body.priority) : undefined,
    stateGroup: body.stateGroup ? String(body.stateGroup) : undefined,
    assignee: body.assignee ? String(body.assignee) : undefined,
  });
  return NextResponse.json({ workItem }, { status: 201 });
}
