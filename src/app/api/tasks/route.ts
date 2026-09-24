import { NextRequest, NextResponse } from "next/server";
import type { DeptId } from "@/lib/types";
import { addRoutine, createTask } from "@/lib/server/runtime";
import { parseCadence } from "@/lib/server/when";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const dept = body.dept as DeptId;
  const model = body.model as string | undefined;
  const repeat = body.repeat as string | undefined;

  if (!title || !dept) {
    return NextResponse.json({ error: "title and dept required" }, { status: 400 });
  }

  // A cadence in the sentence (or an explicit repeat) becomes a routine.
  const cadenceSource = repeat || title;
  const parsed = parseCadence(cadenceSource);
  if (parsed) {
    const cleaned = cleanRoutineTitle(title);
    const routine = addRoutine(cleaned, dept, cadenceSource);
    if (routine) return NextResponse.json({ routine });
  }

  const deps = Array.isArray(body.deps) ? (body.deps as string[]) : undefined;
  const agentId = typeof body.agentId === "string" ? body.agentId : undefined;
  const task = await createTask(title, dept, { model, deps, agentId });
  return NextResponse.json({ task });
}

/** Strip the schedule clause and leftover punctuation from a routine sentence. */
function cleanRoutineTitle(title: string): string {
  const parts = title.split(",").map((p) => p.trim());
  const kept = parts.filter((p) => p && !parseCadence(p));
  const joined = (kept.length ? kept.join(", ") : title)
    .replace(/^(and|then)\s+/i, "")
    .replace(/[,\s]+$/g, "")
    .trim();
  return joined || title;
}
