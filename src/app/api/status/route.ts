import { NextResponse } from "next/server";
import { brainLocation, loadConfig } from "@/lib/server/config";
import { brainGraph } from "@/lib/server/brain";
import { loadSkills } from "@/lib/server/skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = loadConfig();
  const loc = brainLocation();
  const graph = brainGraph();
  const skills = loadSkills();
  return NextResponse.json({
    studio: cfg.studio,
    brainPath: loc.dir,
    vaultId: cfg.vaultId || null,
    vaultConnected: loc.vaultResolved,
    brainSource: loc.source,
    notes: graph.nodes.length,
    links: graph.edges.length,
    skills: skills.length,
    skillNames: skills.map((s) => ({
      name: s.name,
      agents: s.agents,
      department: s.department ?? null,
    })),
  });
}
