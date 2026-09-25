import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { GITHUB_SKILLS_REPO, loadSkills, slugifySkillName, writeUploadedSkill } from "@/lib/server/skills";
import { skillsDir } from "@/lib/server/config";
import { agentById } from "@/lib/office-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function skillPayload() {
  return loadSkills().map((s) => ({
    name: s.name,
    description: s.description,
    department: s.department || null,
    agents: s.agents.map((id) => agentById(id)?.name || id),
    path: s.path,
    source: s.source,
    githubUrl:
      s.source === "github"
        ? `https://github.com/${GITHUB_SKILLS_REPO.owner}/${GITHUB_SKILLS_REPO.name}/blob/main/${s.path.replace(/\\/g, "/")}`
        : null,
  }));
}

export async function GET() {
  return NextResponse.json({
    skills: skillPayload(),
    repo: GITHUB_SKILLS_REPO,
  });
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const files = [...form.getAll("files"), ...form.getAll("file")].filter(
      (f): f is File => typeof File !== "undefined" && f instanceof File,
    );
    if (!files.length) {
      return NextResponse.json({ error: "Choose one or more .md or SKILL.md files." }, { status: 400 });
    }
    const saved: string[] = [];
    try {
      for (const file of files) {
        if (file.size > 400_000) {
          return NextResponse.json({ error: `${file.name} is over 400 KB.` }, { status: 400 });
        }
        const lower = file.name.toLowerCase();
        if (!lower.endsWith(".md")) {
          return NextResponse.json({ error: `${file.name} is not a markdown file.` }, { status: 400 });
        }
        const text = await file.text();
        const result = writeUploadedSkill(text, file.name);
        saved.push(result.name);
      }
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not save the uploaded skill." },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      uploaded: saved,
      skills: skillPayload(),
      repo: GITHUB_SKILLS_REPO,
    });
  }

  const body = await req.json().catch(() => ({}));
  const name = slugifySkillName(String(body.name || ""));
  const description = String(body.description || "").trim();
  const agents = Array.isArray(body.agents) ? body.agents : [];
  const department = String(body.department || "").trim();
  const bodyText = String(body.body || "").trim();
  if (!name || name === "skill") return NextResponse.json({ error: "name required" }, { status: 400 });

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
  ]
    .filter((l) => l !== "")
    .join("\n");

  try {
    const dir = path.join(skillsDir(), name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "SKILL.md"), front);
  } catch {
    return NextResponse.json({ error: "could not write skill (read-only fs?)" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, name, skills: skillPayload(), repo: GITHUB_SKILLS_REPO });
}
