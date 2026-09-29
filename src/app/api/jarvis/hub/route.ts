import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { patchHub, readHub } from "@/lib/server/jarvis-hub";
import type { JarvisHub } from "@/lib/jarvis-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(readHub(user.id, user.username));
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const prev = readHub(user.id, user.username);
  const body = (await req.json().catch(() => ({}))) as Partial<JarvisHub>;
  const next = patchHub(user.id, user.username, body);
  const nextTz = next.profile.timezone;
  if (nextTz && nextTz !== prev.profile.timezone) {
    const { ensureStarted, resyncRoutineTimezones } = await import("@/lib/server/runtime");
    await ensureStarted();
    resyncRoutineTimezones(nextTz);
  }
  return NextResponse.json(next);
}
