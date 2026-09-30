import { NextRequest, NextResponse } from "next/server";
import type { BriefKind } from "@/lib/types";
import { composeBrief, latestBrief, liveFallbackBrief, loadBriefs } from "@/lib/server/briefs";
import { emitBrief, ensureStarted, listOfficeTasks } from "@/lib/server/runtime";
import { DEFAULT_TZ, dateKeyInZone } from "@/lib/server/zone";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await ensureStarted();
  const kind = req.nextUrl.searchParams.get("kind") as BriefKind | null;
  const date = req.nextUrl.searchParams.get("date") || undefined;
  const stored = loadBriefs();
  const tasks = listOfficeTasks();
  if (kind) {
    const found = latestBrief(kind, date);
    const brief = found || liveFallbackBrief(kind, tasks);
    return NextResponse.json({ brief, briefs: stored });
  }
  const briefs = [...stored];
  const today = dateKeyInZone(DEFAULT_TZ);
  if (!briefs.some((b) => b.kind === "morning" && b.date === today)) briefs.push(liveFallbackBrief("morning", tasks));
  if (!briefs.some((b) => b.kind === "evening" && b.date === today)) briefs.push(liveFallbackBrief("evening", tasks));
  return NextResponse.json({ briefs });
}

export async function POST(req: NextRequest) {
  await ensureStarted();
  const body = await req.json().catch(() => ({}));
  const kind: BriefKind = body.kind === "evening" ? "evening" : "morning";
  const brief = await composeBrief({
    kind,
    tasks: listOfficeTasks(),
    source: "on-demand",
  });
  emitBrief(brief);
  return NextResponse.json({ brief, briefs: loadBriefs() });
}
