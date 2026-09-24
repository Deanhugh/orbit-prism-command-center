import { NextResponse } from "next/server";
import { AGENTS, DEPARTMENTS } from "@/lib/office-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const roster = DEPARTMENTS.map((d) => ({
    department: d.id,
    name: d.name,
    agents: AGENTS.filter((a) => a.dept === d.id).map((a) => ({
      id: a.id,
      name: a.name,
      role: a.role,
      lead: a.lead,
    })),
  }));
  return NextResponse.json({ roster });
}
