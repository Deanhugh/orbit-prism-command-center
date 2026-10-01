import { NextRequest, NextResponse } from "next/server";
import { currentDrawBoard, listDrawBoards, patchDrawBoard } from "@/lib/server/draw";
import type { DrawJsonElement } from "@/lib/draw-scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    current: currentDrawBoard(),
    boards: listDrawBoards().map((m) => ({
      id: m.id,
      title: m.title,
      prompt: m.prompt,
      agentName: m.agentName,
      elements: m.elements.length,
      updatedAt: m.updatedAt,
    })),
  });
}

export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const elements = Array.isArray(body.elements) ? (body.elements as DrawJsonElement[]) : undefined;
  const appState =
    body.appState && typeof body.appState === "object"
      ? (body.appState as { viewBackgroundColor: string })
      : undefined;
  const board = patchDrawBoard(id, { elements, appState });
  if (!board) return NextResponse.json({ error: "board not found" }, { status: 404 });
  return NextResponse.json({ board });
}
