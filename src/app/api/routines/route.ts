import { NextRequest, NextResponse } from "next/server";
import type { DeptId, RoutineKind, BriefKind } from "@/lib/types";
import {
  addRoutine,
  getSnapshot,
  mutateRoutine,
  updateRoutine,
} from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snap = await getSnapshot();
  return NextResponse.json({ routines: snap.routines });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const dept = (body.dept as DeptId) || "ops";
  const cadence = String(body.cadence || "").trim();
  if (!title || !cadence) {
    return NextResponse.json({ error: "title and cadence required" }, { status: 400 });
  }
  const kind = (body.kind as RoutineKind) || "task";
  const briefKind = body.briefKind as BriefKind | undefined;
  const routine = addRoutine(title, dept, cadence, {
    kind,
    briefKind: kind === "brief" ? briefKind || (title.toLowerCase().includes("evening") ? "evening" : "morning") : undefined,
    paused: Boolean(body.paused),
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
  });
  if (!routine) {
    return NextResponse.json({ error: "could not read a schedule" }, { status: 400 });
  }
  return NextResponse.json({ routine });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  if (body.action === "pause" || body.action === "resume" || body.action === "run" || body.action === "delete") {
    const routines = mutateRoutine(id, body.action);
    return NextResponse.json({ routines });
  }

  const routine = updateRoutine(id, {
    title: typeof body.title === "string" ? body.title : undefined,
    paused: typeof body.paused === "boolean" ? body.paused : undefined,
    cadence: typeof body.cadence === "string" ? body.cadence : undefined,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    hour: typeof body.hour === "number" ? body.hour : undefined,
    minute: typeof body.minute === "number" ? body.minute : undefined,
    dept: body.dept as DeptId | undefined,
  });
  if (!routine) return NextResponse.json({ error: "not found" }, { status: 404 });
  const snap = await getSnapshot();
  return NextResponse.json({ routine, routines: snap.routines });
}
