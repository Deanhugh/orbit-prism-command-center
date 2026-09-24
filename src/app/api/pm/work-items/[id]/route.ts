import { NextRequest, NextResponse } from "next/server";
import { updateWorkItem } from "@/lib/server/plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const workItem = await updateWorkItem(id, {
    name: body.name !== undefined ? String(body.name) : undefined,
    priority: body.priority !== undefined ? String(body.priority) : undefined,
    stateGroup: body.stateGroup !== undefined ? String(body.stateGroup) : undefined,
    assignee: body.assignee !== undefined ? String(body.assignee) : undefined,
  });
  if (!workItem) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ workItem });
}
