#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.b64(?:\.part\d+)?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Group part files: foo.png.b64 + foo.png.b64.part01 → dest foo.png */
function groupParts(files) {
  const groups = new Map();
  for (const file of files) {
    const match = file.match(/^(.*\.b64)(?:\.part(\d+))?$/);
    if (!match) continue;
    const key = match[1];
    const part = match[2] ? Number(match[2]) : 0;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ part, file });
  }
  return groups;
}

const roots = ["public", "assets", "brain", "src"];
let count = 0;
for (const root of roots) {
  const groups = groupParts(walk(root));
  for (const [b64Path, parts] of groups) {
    const dest = b64Path.slice(0, -4);
    const ordered = parts.sort((a, b) => a.part - b.part);
    const text = ordered.map((p) => fs.readFileSync(p.file, "utf8")).join("");
    const data = Buffer.from(text, "base64");
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, data);
    count += 1;
    console.log(`decoded ${dest} (${data.length} bytes from ${ordered.length} part(s))`);
  }
}
if (count === 0) console.log("no .b64 assets to decode");
