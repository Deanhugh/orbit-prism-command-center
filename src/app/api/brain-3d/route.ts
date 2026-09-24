import { NextResponse } from "next/server";
import { brainGraph3D } from "@/lib/server/brain";
import { brainLocation } from "@/lib/server/config";
import { BRAIN_CATEGORIES } from "@/lib/brain-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const graph = brainGraph3D();
  const loc = brainLocation();
  return NextResponse.json({
    name: graph.name,
    vaultConnected: loc.vaultResolved,
    categories: BRAIN_CATEGORIES,
    nodes: graph.nodes,
    edges: graph.edges,
  });
}
