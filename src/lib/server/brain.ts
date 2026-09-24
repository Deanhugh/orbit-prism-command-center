import fs from "node:fs";
import path from "node:path";
import type { BrainNode } from "../types";
import { brainDir } from "./config";
import { categoryFor, categoryForExt } from "../brain-categories";
import { loadSkills } from "./skills";

// Text note formats Obsidian vaults use — read as full nodes with links.
const NOTE_EXTS = [".md", ".markdown", ".mdx", ".txt"];

function walk(dir: string, acc: string[] = []): string[] {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      // skip Obsidian/system config folders, keep everything else
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      walk(full, acc);
    } else if (NOTE_EXTS.some((ext) => e.name.toLowerCase().endsWith(ext))) {
      acc.push(full);
    }
  }
  return acc;
}

function titleOf(file: string, content: string): string {
  const h1 = content.match(/^#\s+(.+)$/m);
  if (h1) return h1[1].trim();
  return path.basename(file).replace(/\.md$/i, "");
}

export interface BrainDoc {
  path: string;
  rel: string;
  title: string;
  content: string;
  links: string[];
}

export function readBrain(): BrainDoc[] {
  const root = brainDir();
  const files = walk(root);
  const docs: BrainDoc[] = [];
  for (const file of files) {
    let content = "";
    try {
      content = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }
    const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) =>
      m[1].split("|")[0].trim(),
    );
    docs.push({
      path: file,
      rel: path.relative(root, file),
      title: titleOf(file, content),
      content,
      links,
    });
  }
  return docs;
}

export function brainGraph(): { nodes: BrainNode[]; edges: [string, string][] } {
  const docs = readBrain();
  const byTitle = new Map<string, BrainDoc>();
  for (const d of docs) byTitle.set(d.title.toLowerCase(), d);
  const nodes: BrainNode[] = docs.map((d) => ({
    id: d.title,
    title: d.title,
    path: d.rel,
    links: d.links,
    size: Math.min(28, 8 + d.content.length / 400),
  }));
  const edges: [string, string][] = [];
  for (const d of docs) {
    for (const link of d.links) {
      const target = byTitle.get(link.toLowerCase());
      if (target) edges.push([d.title, target.title]);
    }
  }
  return { nodes, edges };
}

export interface Brain3DNode {
  id: string;
  title: string;
  path: string;
  category: string;
  links: string[];
  size: number;
}

/** Walk the vault for every file (not just notes), skipping config/system dirs. */
function walkAll(dir: string, root: string, acc: { full: string; rel: string }[] = []) {
  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
      walkAll(full, root, acc);
    } else if (!e.name.startsWith(".")) {
      acc.push({ full, rel: path.relative(root, full) });
    }
  }
  return acc;
}

/**
 * Categorized graph for the 3D Brain: EVERY file in the vault as a node —
 * text notes (with [[links]] and ![[embeds]]), plus images, PDFs, .canvas and
 * other attachments. Bound skills are included too. Canvas files link to the
 * files they embed; notes link to the attachments they embed.
 */
export function brainGraph3D(): {
  name: string;
  nodes: Brain3DNode[];
  edges: [string, string][];
} {
  const root = brainDir();
  const files = walkAll(root, root);
  const nodes: Brain3DNode[] = [];
  const byTitle = new Map<string, string>();
  const byPath = new Map<string, string>();
  const byBase = new Map<string, string>();

  const register = (n: Brain3DNode) => {
    nodes.push(n);
    byTitle.set(n.title.toLowerCase(), n.id);
    byPath.set(n.path.toLowerCase(), n.id);
    byBase.set(path.basename(n.path).toLowerCase(), n.id);
  };

  for (const f of files) {
    const ext = path.extname(f.rel).toLowerCase();
    const isText = [".md", ".markdown", ".mdx", ".txt"].includes(ext);
    if (isText) {
      let content = "";
      try {
        content = fs.readFileSync(f.full, "utf8");
      } catch {
        continue;
      }
      const title = titleOf(f.full, content);
      // [[wiki]] and ![[embeds]] both count as links
      const links = [...content.matchAll(/!?\[\[([^\]]+)\]\]/g)].map((m) =>
        m[1].split("|")[0].split("#")[0].trim(),
      );
      register({
        id: title,
        title,
        path: f.rel,
        category: categoryFor(f.rel, title),
        links,
        size: Math.min(30, 10 + content.length / 350),
      });
    } else if (ext === ".canvas") {
      let refs: string[] = [];
      try {
        const j = JSON.parse(fs.readFileSync(f.full, "utf8"));
        refs = (j.nodes || [])
          .map((cn: { file?: string }) => cn.file)
          .filter(Boolean);
      } catch {
        /* not valid canvas json */
      }
      register({
        id: f.rel,
        title: path.basename(f.rel),
        path: f.rel,
        category: "canvas",
        links: refs,
        size: 16,
      });
    } else {
      register({
        id: f.rel,
        title: path.basename(f.rel),
        path: f.rel,
        category: categoryForExt(ext),
        links: [],
        size: 12,
      });
    }
  }

  // bound skills as nodes (connect to the notes they reference)
  for (const s of loadSkills()) {
    const links = [...s.body.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) =>
      m[1].split("|")[0].trim(),
    );
    register({
      id: `skill:${s.name}`,
      title: s.name,
      path: s.path,
      category: "skills",
      links,
      size: 14,
    });
  }

  const resolve = (link: string): string | undefined => {
    const l = link.toLowerCase();
    return (
      byTitle.get(l) ||
      byPath.get(l) ||
      byBase.get(l) ||
      byBase.get(path.basename(l)) ||
      byTitle.get(l.replace(/\.[a-z0-9]+$/, ""))
    );
  };

  const edges: [string, string][] = [];
  const seen = new Set<string>();
  for (const n of nodes) {
    for (const link of n.links) {
      const target = resolve(link);
      if (target && target !== n.id) {
        const key = n.id + "|" + target;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([n.id, target]);
        }
      }
    }
  }

  return { name: "Orbit Prism Brain", nodes, edges };
}

/** Naive keyword retrieval — a handful of the most relevant notes. */
export function retrieve(query: string, limit = 4): BrainDoc[] {
  const docs = readBrain();
  const terms = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 3);
  const scored = docs.map((d) => {
    const hay = (d.title + " " + d.content).toLowerCase();
    let score = 0;
    for (const t of terms) {
      if (hay.includes(t)) score += hay.split(t).length - 1;
    }
    return { d, score };
  });
  return scored
    .sort((x, y) => y.score - x.score)
    .slice(0, limit)
    .filter((s) => s.score > 0)
    .map((s) => s.d);
}

export interface DocMeta {
  title: string;
  rel: string;
  mtime: number;
  words: number;
}

/** Recent notes by file modified time — the Vault "documents / inbox trail". */
export function docsMeta(limit = 8): DocMeta[] {
  return readBrain()
    .map((d) => {
      let mtime = 0;
      try {
        mtime = fs.statSync(d.path).mtimeMs;
      } catch {
        /* ignore */
      }
      const words = d.content.split(/\s+/).filter(Boolean).length;
      return { title: d.title, rel: d.rel, mtime, words };
    })
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, limit);
}

export function totalWords(): number {
  return readBrain().reduce(
    (sum, d) => sum + d.content.split(/\s+/).filter(Boolean).length,
    0,
  );
}

export interface Directive {
  text: string;
  done: boolean;
}

/**
 * Directives from the vault: checklist items in a note named Directives / Today /
 * Agenda / Priorities, or under a "## Directives" heading in any note.
 */
export function directivesFromBrain(limit = 6): Directive[] {
  const docs = readBrain();
  const names = ["directives", "today", "agenda", "priorities"];
  const checklist = (text: string): Directive[] =>
    [...text.matchAll(/^\s*-\s*\[( |x|X)\]\s*(.+)$/gm)].map((m) => ({
      done: m[1].toLowerCase() === "x",
      text: m[2].trim(),
    }));

  const named = docs.find((d) => names.includes(d.title.toLowerCase()));
  if (named) {
    const items = checklist(named.content);
    if (items.length) return items.slice(0, limit);
  }
  for (const d of docs) {
    const items = checklist(d.content);
    if (items.length) return items.slice(0, limit);
  }
  return [];
}

export function readDoc(rel: string): BrainDoc | null {
  // Notes live under the brain dir; bound skills live under the repo (skills/...).
  const candidates = rel.startsWith("skills" + path.sep) || rel.startsWith("skills/")
    ? [path.join(process.cwd(), rel), path.join(brainDir(), rel)]
    : [path.join(brainDir(), rel), path.join(process.cwd(), rel)];
  for (const full of candidates) {
    try {
      const content = fs.readFileSync(full, "utf8");
      const links = [...content.matchAll(/\[\[([^\]]+)\]\]/g)].map((m) =>
        m[1].split("|")[0].trim(),
      );
      return { path: full, rel, title: titleOf(full, content), content, links };
    } catch {
      /* try next */
    }
  }
  return null;
}

/** Write a deliverable back as a dated note. Best-effort (read-only FS on cloud). */
export function writeDeliverable(
  agentName: string,
  title: string,
  body: string,
  reads: string[],
): string | null {
  try {
    const dir = path.join(brainDir(), "Orbit Prism Operating System");
    fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const safe = title.replace(/[^a-z0-9]+/gi, "-").slice(0, 48).toLowerCase();
    const rel = path.join("Orbit Prism Operating System", `${date}-${safe}.md`);
    const full = path.join(brainDir(), rel);
    const linkBlock = reads.length
      ? "\n\n---\nRead: " + reads.map((r) => `[[${r}]]`).join(", ")
      : "";
    fs.writeFileSync(
      full,
      `# ${title}\n\n_By ${agentName} · ${date}_\n\n${body}${linkBlock}\n`,
    );
    return rel;
  } catch {
    return null;
  }
}
