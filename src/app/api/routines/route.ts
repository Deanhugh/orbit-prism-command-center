import { NextRequest, NextResponse } from "next/server";
import type { DeptId } from "@/lib/types";
import { addRoutine, getSnapshot, mutateRoutine } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await getSnapshot();
  return NextResponse.json({ routines: snap.routines });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const dept = body.dept as DeptId;
  const cadence = String(body.cadence || "").trim();
  if (!title || !dept || !cadence) {
    return NextResponse.json({ error: "title, dept, cadence required" }, { status: 400 });
  }
  const routine = addRoutine(title, dept, cadence);
  if (!routine) {
    return NextResponse.json({ error: "could not read a schedule" }, { status: 400 });
  }
  return NextResponse.json({ routine });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = body.action as "pause" | "resume" | "run" | "delete";
  const routines = mutateRoutine(id, action);
  return NextResponse.json({ routines });
}
