import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export interface OfficeConfig {
  name: string;
  studio: string;
  brain: string;
  /** Obsidian vault ID — resolved to a folder path via Obsidian's registry. */
  vaultId: string;
  port: number;
  model: string;
  mcp: { allow: string[]; deny: string[]; departments: Record<string, string[]> };
  tools: { web: boolean };
}

const DEFAULTS: OfficeConfig = {
  name: "Orbit Prism Operating System",
  studio: "Northwind Atelier",
  brain: "./brain",
  vaultId: "",
  port: 43140,
  model: "sonnet",
  mcp: { allow: [], deny: [], departments: {} },
  tools: { web: true },
};

let cached: OfficeConfig | null = null;

export function loadConfig(): OfficeConfig {
  if (cached) return cached;
  const root = process.cwd();
  const merged: OfficeConfig = { ...DEFAULTS };
  for (const file of ["office.config.json", "office.config.local.json"]) {
    try {
      const raw = fs.readFileSync(path.join(root, file), "utf8");
      Object.assign(merged, JSON.parse(raw));
    } catch {
      /* optional */
    }
  }
  if (process.env.ORBIT_BRAIN) merged.brain = process.env.ORBIT_BRAIN;
  cached = merged;
  return merged;
}

/** Location of Obsidian's vault registry per OS. */
function obsidianRegistryPaths(): string[] {
  const home = os.homedir();
  return [
    path.join(home, "Library", "Application Support", "obsidian", "obsidian.json"), // macOS
    path.join(
      process.env.APPDATA || path.join(home, "AppData", "Roaming"),
      "obsidian",
      "obsidian.json",
    ), // Windows
    path.join(home, ".config", "obsidian", "obsidian.json"), // Linux
  ];
}

/** Resolve an Obsidian vault ID to its folder path using the local registry. */
export function resolveVaultPath(vaultId: string): string | null {
  for (const reg of obsidianRegistryPaths()) {
    try {
      const raw = fs.readFileSync(reg, "utf8");
      const json = JSON.parse(raw) as {
        vaults?: Record<string, { path?: string }>;
      };
      const p = json.vaults?.[vaultId]?.path;
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* try next */
    }
  }
  return null;
}

export interface BrainLocation {
  dir: string;
  source: "vault" | "path";
  vaultResolved: boolean;
}

function seedBrainIfEmpty(dest: string, sample: string) {
  try {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    const hasNotes = fs.readdirSync(dest).some((f) => f.toLowerCase().endsWith(".md"));
    if (hasNotes || !fs.existsSync(sample)) return;
    for (const name of fs.readdirSync(sample)) {
      const src = path.join(sample, name);
      const out = path.join(dest, name);
      if (!fs.statSync(src).isFile()) continue;
      if (!fs.existsSync(out)) fs.copyFileSync(src, out);
    }
  } catch {
    /* volume may be read-only in some hosts */
  }
}

export function brainLocation(): BrainLocation {
  const cfg = loadConfig();
  const sample = path.join(process.cwd(), "brain");

  // 1. Prefer the Obsidian vault ID when it resolves on this machine (Mac).
  if (cfg.vaultId) {
    const resolved = resolveVaultPath(cfg.vaultId);
    if (resolved) return { dir: resolved, source: "vault", vaultResolved: true };
  }

  // 2. ORBIT_BRAIN / configured path. On Railway this is the volume at /app/data/brain.
  const configured = path.isAbsolute(cfg.brain)
    ? cfg.brain
    : path.join(process.cwd(), cfg.brain);
  if (process.env.ORBIT_BRAIN) {
    seedBrainIfEmpty(configured, sample);
    if (fs.existsSync(configured)) {
      return { dir: configured, source: "path", vaultResolved: false };
    }
  }
  if (fs.existsSync(configured)) {
    return { dir: configured, source: "path", vaultResolved: false };
  }

  // 3. Bundled sample brain (last resort).
  return { dir: sample, source: "path", vaultResolved: false };
}

export function brainDir(): string {
  return brainLocation().dir;
}

/** Merge a patch into office.config.local.json (gitignored) and clear the cache. */
export function updateLocalConfig(patch: Record<string, unknown>): void {
  const file = path.join(process.cwd(), "office.config.local.json");
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    /* none yet */
  }
  const merged: Record<string, unknown> = { ...existing };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === "object" && !Array.isArray(v) && existing[k] && typeof existing[k] === "object") {
      merged[k] = { ...(existing[k] as object), ...(v as object) };
    } else {
      merged[k] = v;
    }
  }
  try {
    fs.writeFileSync(file, JSON.stringify(merged, null, 2));
  } catch {
    /* read-only fs */
  }
  cached = null;
}

export function dataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

// ---- custom MCP/CLI connectors added from Settings ------------------------

export interface CustomConnector {
  name: string;
  transport: "stdio" | "sse" | "http";
  target: string; // command (stdio) or URL (sse/http)
  args?: string[];
  depts?: string[];
  addedAt: number;
  /** How Command Center authenticates a remote MCP. stdio stays CLI-only. */
  auth?: "none" | "bearer" | "oauth";
}

function customConnectorsFile(): string {
  return path.join(dataDir(), "connectors.json");
}

export function loadCustomConnectors(): CustomConnector[] {
  try {
    const raw = fs.readFileSync(customConnectorsFile(), "utf8");
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function saveCustomConnectors(list: CustomConnector[]): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(customConnectorsFile(), JSON.stringify(list, null, 2));
  } catch {
    /* read-only fs */
  }
}

export function addCustomConnector(c: CustomConnector): CustomConnector[] {
  const list = loadCustomConnectors().filter((x) => x.name.toLowerCase() !== c.name.toLowerCase());
  list.unshift(c);
  saveCustomConnectors(list);
  return list;
}

export function removeCustomConnector(name: string): CustomConnector[] {
  const list = loadCustomConnectors().filter((x) => x.name.toLowerCase() !== name.toLowerCase());
  saveCustomConnectors(list);
  return list;
}

export function skillsDir(): string {
  return path.join(dataDir(), "skills");
}

/** Skills checked into the repo (survive deploys). */
export function repoSkillsDir(): string {
  return path.join(process.cwd(), "skills");
}

/** Demo mode forced by env — used on serverless / cloud hosts. */
export function forcedDemo(): boolean {
  return (process.env.ORBIT_MODE || "").toLowerCase() === "demo";
}
