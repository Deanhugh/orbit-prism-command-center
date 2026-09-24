import { NextResponse } from "next/server";
import { brainLocation, loadConfig } from "@/lib/server/config";
import {
  brainGraph,
  directivesFromBrain,
  docsMeta,
  totalWords,
} from "@/lib/server/brain";
import { loadSkills } from "@/lib/server/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = loadConfig();
  const loc = brainLocation();
  const graph = brainGraph();
  return NextResponse.json({
    studio: cfg.studio,
    vaultConnected: loc.vaultResolved,
    brainPath: loc.dir,
    notes: graph.nodes.length,
    links: graph.edges.length,
    skills: loadSkills().length,
    words: totalWords(),
    documents: docsMeta(8),
    directives: directivesFromBrain(6),
  });
}
