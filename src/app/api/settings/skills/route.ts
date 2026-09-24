import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { loadSkills } from "@/lib/server/skills";
import { skillsDir } from "@/lib/server/config";
import { agentById } from "@/lib/office-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const skills = loadSkills().map((s) => ({
    name: s.name,
    description: s.description,
    department: s.department || null,
    agents: s.agents.map((id) => agentById(id)?.name || id),
    path: s.path,
  }));
  return NextResponse.json({ skills });
}

// create a new skill folder skills/<name>/SKILL.md
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const description = String(body.description || "").trim();
  const agents = Array.isArray(body.agents) ? body.agents : [];
  const department = String(body.department || "").trim();
  const bodyText = String(body.body || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const front = [
    "---",
    `name: ${name}`,
    description ? `description: ${description}` : "",
    agents.length ? `agents: [${agents.join(", ")}]` : "",
    department ? `department: ${department}` : "",
    "---",
    "",
    `# ${name}`,
    "",
    bodyText || "Describe how this kind of work is done, step by step.",
    "",
  ].filter((l) => l !== "").join("\n");

  try {
    const dir = path.join(skillsDir(), name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), front);
  } catch {
    return NextResponse.json({ error: "could not write skill (read-only fs?)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name });
}
