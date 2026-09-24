import fs from "node:fs";
import path from "node:path";
import type { DeptId } from "../types";
import { brainDir, skillsDir } from "./config";

export interface Skill {
  name: string;
  description: string;
  agents: string[];
  department?: string;
  path: string;
  body: string;
}

function parseFrontMatter(raw: string): {
  data: Record<string, string | string[]>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, string | string[]> = {};
  const lines = m[1].split(/\r?\n/);
  const clean = (s: string) => s.trim().replace(/^["']|["']$/g, "");
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    const rest = kv[2].trim();

    if (rest.startsWith("[") && rest.endsWith("]")) {
      // inline list: agents: [a, b]
      data[key] = rest
        .slice(1, -1)
        .split(",")
        .map(clean)
        .filter(Boolean);
    } else if (rest === "") {
      // possible YAML block list: following indented "- item" lines
      const items: string[] = [];
      let j = i + 1;
      while (j < lines.length && /^\s*-\s+/.test(lines[j])) {
        items.push(clean(lines[j].replace(/^\s*-\s+/, "")));
        j++;
      }
      if (items.length) {
        data[key] = items.filter(Boolean);
        i = j - 1;
      } else {
        data[key] = "";
      }
    } else {
      data[key] = clean(rest);
    }
  }
  return { data, body: m[2].trim() };
}

/** Where skills may live: the repo, and inside the Obsidian vault. */
function skillRoots(): string[] {
  const brain = brainDir();
  return [
    skillsDir(),
    path.join(brain, "skills"),
    path.join(brain, "Skills"),
    path.join(brain, "OrbitPrism", "skills"),
    path.join(brain, "Orbit Prism", "skills"),
    path.join(brain, "Orbit Prism Operating System", "skills"),
  ];
}

function toSkill(name: string, raw: string, file: string): Skill {
  const { data, body } = parseFrontMatter(raw);
  return {
    name: (data.name as string) || name,
    description: (data.description as string) || "",
    agents: ((data.agents as string[]) || []).map((a) => a.toLowerCase()),
    department: (data.department as string | undefined)?.toLowerCase(),
    path: path.relative(process.cwd(), file),
    body,
  };
}

export function loadSkills(): Skill[] {
  const skills: Skill[] = [];
  const seen = new Set<string>();
  for (const root of skillRoots()) {
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      let file: string | null = null;
      let fallbackName = e.name;
      if (e.isDirectory()) {
        // a skill folder with a SKILL.md
        const p = path.join(root, e.name, "SKILL.md");
        if (fs.existsSync(p)) file = p;
      } else if (e.name.toLowerCase().endsWith(".md")) {
        // a single Obsidian note with front matter (skip plain SKILL.md name clash)
        file = path.join(root, e.name);
        fallbackName = e.name.replace(/\.md$/i, "");
      }
      if (!file) continue;
      let raw = "";
      try {
        raw = fs.readFileSync(file, "utf8");
      } catch {
        continue;
      }
      // Only treat loose .md files as skills if they declare front matter.
      if (!e.isDirectory() && !/^---\n/.test(raw)) continue;
      const skill = toSkill(fallbackName, raw, file);
      if (seen.has(skill.name.toLowerCase())) continue;
      seen.add(skill.name.toLowerCase());
      skills.push(skill);
    }
  }
  return skills;
}

export function skillsForAgent(agentId: string, dept: DeptId): Skill[] {
  const id = agentId.toLowerCase();
  return loadSkills().filter(
    (s) =>
      s.agents.includes(id) ||
      s.agents.includes("all") ||
      s.department === dept ||
      s.department === "all",
  );
}
