import { NextResponse } from "next/server";
import { currentStudioProduction, listStudioProductions } from "@/lib/server/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    current: currentStudioProduction(),
    productions: listStudioProductions().map((m) => ({
      id: m.id,
      title: m.title,
      prompt: m.prompt,
      kind: m.kind,
      aspect: m.aspect,
      runtimeSec: m.runtimeSec,
      agentName: m.agentName,
      shots: m.shots.length,
      updatedAt: m.updatedAt,
    })),
  });
}
