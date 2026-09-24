import { NextResponse } from "next/server";
import { loadSkills } from "@/lib/server/skills";
import { agentById } from "@/lib/office-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const skills = loadSkills().map((s) => ({
    name: s.name,
    description: s.description,
    department: s.department,
    agents: s.agents.map((id) => agentById(id)?.name || id),
    path: s.path,
  }));
  return NextResponse.json({ skills });
}
