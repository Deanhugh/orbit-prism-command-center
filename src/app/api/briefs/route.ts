import { NextRequest, NextResponse } from "next/server";
import type { BriefKind } from "@/lib/types";
import { composeBrief, latestBrief, liveFallbackBrief, loadBriefs } from "@/lib/server/briefs";
import { emitBrief, ensureStarted, listOfficeTasks } from "@/lib/server/runtime";

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
  if (!briefs.some((b) => b.kind === "morning")) briefs.push(liveFallbackBrief("morning", tasks));
  if (!briefs.some((b) => b.kind === "evening")) briefs.push(liveFallbackBrief("evening", tasks));
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
