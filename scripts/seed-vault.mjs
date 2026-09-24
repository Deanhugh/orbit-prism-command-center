#!/usr/bin/env node
// Seed the sample skills into your Obsidian vault's skills/ folder.
// Run on the machine that has the vault:  npm run seed:vault  [-- --force]
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = process.cwd();
const force = process.argv.includes("--force");

function loadConfig() {
  const cfg = {};
  for (const f of ["office.config.json", "office.config.local.json"]) {
    try {
      Object.assign(cfg, JSON.parse(fs.readFileSync(path.join(root, f), "utf8")));
    } catch {
      /* optional */
    }
  }
  return cfg;
}

function resolveVaultPath(vaultId) {
  if (!vaultId) return null;
  const home = os.homedir();
  const regs = [
    path.join(home, "Library", "Application Support", "obsidian", "obsidian.json"),
    path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "obsidian", "obsidian.json"),
    path.join(home, ".config", "obsidian", "obsidian.json"),
  ];
  for (const reg of regs) {
    try {
      const json = JSON.parse(fs.readFileSync(reg, "utf8"));
      const p = json?.vaults?.[vaultId]?.path;
      if (p && fs.existsSync(p)) return p;
    } catch {
      /* next */
    }
  }
  return null;
}

function resolveVaultDir(cfg) {
  const byId = resolveVaultPath(cfg.vaultId);
  if (byId) return { dir: byId, how: `vault id ${cfg.vaultId}` };
  if (cfg.brain) {
    const p = path.isAbsolute(cfg.brain) ? cfg.brain : path.join(root, cfg.brain);
    // don't seed into the bundled sample brain
    if (p !== path.join(root, "brain") && fs.existsSync(p)) {
      return { dir: p, how: `brain path ${p}` };
    }
  }
  return null;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

const cfg = loadConfig();
const resolved = resolveVaultDir(cfg);

if (!resolved) {
  console.log("• Could not find your Obsidian vault on this machine.");
  console.log("  Run this on the machine that has the vault, and make sure Obsidian has");
  console.log(`  opened it at least once (vault id: ${cfg.vaultId || "unset"}).`);
  console.log(`  Or set an absolute "brain" path in office.config.json.`);
  process.exit(0);
}

const srcSkills = path.join(root, "skills");
const destSkills = path.join(resolved.dir, "skills");
console.log(`→ Vault: ${resolved.dir}  (${resolved.how})`);

let copied = 0;
let skipped = 0;
for (const e of fs.readdirSync(srcSkills, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const dest = path.join(destSkills, e.name);
  if (fs.existsSync(dest) && !force) {
    console.log(`  · ${e.name} — already present, skipped`);
    skipped++;
    continue;
  }
  copyDir(path.join(srcSkills, e.name), dest);
  console.log(`  ✓ ${e.name} — seeded`);
  copied++;
}

console.log(`\nDone. ${copied} seeded, ${skipped} skipped → ${destSkills}`);
console.log("Edit them in Obsidian; the office re-reads skills on the next task.");
