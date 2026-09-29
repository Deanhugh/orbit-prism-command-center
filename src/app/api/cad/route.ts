import { NextResponse } from "next/server";
import { currentCadModel, listCadModels } from "@/lib/server/cad";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    current: currentCadModel(),
    models: listCadModels().map((m) => ({
      id: m.id,
      title: m.title,
      prompt: m.prompt,
      agentName: m.agentName,
      solids: m.solids.length,
      updatedAt: m.updatedAt,
    })),
  });
}
