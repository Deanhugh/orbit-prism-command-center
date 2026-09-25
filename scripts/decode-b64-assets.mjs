#!/usr/bin/env node
/**
 * Rebuild binary assets from checksummed, triplicated .hex sidecars
 * (preferred) or legacy .b64 / .b64.part* files.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function majorityString(copies) {
  const cleaned = copies.map((c) => c.replace(/[^0-9a-fA-F]/g, "").toLowerCase());
  const max = Math.max(0, ...cleaned.map((c) => c.length));
  let out = "";
  for (let i = 0; i < max; i++) {
    const counts = new Map();
    for (const copy of cleaned) {
      const ch = copy[i];
      if (!ch) continue;
      counts.set(ch, (counts.get(ch) || 0) + 1);
    }
    let best = "0";
    let bestN = -1;
    for (const [ch, n] of counts) {
      if (n > bestN) {
        best = ch;
        bestN = n;
      }
    }
    out += best;
  }
  return out;
}

function decodeHexPart(text) {
  const blocks = text.split(/\n---\n/);
  const header = (blocks[0] || "").trim();
  const shaMatch = header.match(/sha256[:\s]+([0-9a-f]{64})/i);
  const expected = shaMatch ? shaMatch[1].toLowerCase() : null;
  const copies = blocks.length >= 2 ? blocks.slice(1) : [text];
  const hex = majorityString(copies);
  if (hex.length % 2 !== 0) {
    throw new Error(`odd hex length ${hex.length}`);
  }
  const data = Buffer.from(hex, "hex");
  const actual = crypto.createHash("sha256").update(data).digest("hex");
  if (expected && actual !== expected) {
    throw new Error(`sha256 mismatch expected=${expected} actual=${actual}`);
  }
  return data;
}

function groupByPrefix(files, extRe) {
  const groups = new Map();
  for (const file of files) {
    const match = file.match(extRe);
    if (!match) continue;
    const key = match[1];
    const part = match[2] ? Number(match[2]) : 0;
    const sub = match[3] || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ part, sub, file });
  }
  return groups;
}

function looksLikeImage(dest, data) {
  if (!data || data.length < 16) return false;
  const png = data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47;
  const jpg = data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  const ico = data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00;
  const webp = data.slice(0, 4).toString("ascii") === "RIFF" && data.slice(8, 12).toString("ascii") === "WEBP";
  const pdf = data.slice(0, 4).toString("ascii") === "%PDF";
  if (dest.endsWith(".png")) return png;
  if (dest.endsWith(".jpg") || dest.endsWith(".jpeg")) return jpg;
  if (dest.endsWith(".ico")) return ico;
  if (dest.endsWith(".webp")) return webp;
  if (dest.endsWith(".pdf")) return pdf;
  return png || jpg || ico || webp || pdf;
}

const rootUploads = [
  { from: "profile.png", to: "public/profile.png" },
  { from: "orbit-command-center.png", to: "public/orbit-command-center.png" },
  { from: "orbitcommandcenter.png", to: "public/orbit-command-center.png" },
  { from: "Orbit-Command- Center.png", to: "public/orbit-command-center.png" },
];
for (const { from, to } of rootUploads) {
  if (!fs.existsSync(from)) continue;
  const data = fs.readFileSync(from);
  if (!looksLikeImage(to, data)) {
    console.warn(`skip root upload ${from}: not a valid image`);
    continue;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, data);
  console.log(`copied ${from} -> ${to} (${data.length} bytes)`);
}

const roots = ["public", "assets", "brain", "src"];
let count = 0;
const hexDests = new Set();

for (const root of roots) {
  const files = walk(root);
  const groups = groupByPrefix(files, /^(.*\.hex)(?:\.part(\d+)([a-z])?)?$/);
  for (const [hexPath, parts] of groups) {
    const dest = hexPath.slice(0, -4);
    if (dest.endsWith("favicon.ico")) {
      console.log(`skip sidecar for ${dest}`);
      continue;
    }
    const existing = fs.existsSync(dest) ? fs.statSync(dest).size : 0;
    if (existing > 512) {
      hexDests.add(dest);
      console.log(`keep existing ${dest} (${existing} bytes; skip hex)`);
      continue;
    }
    try {
      const ordered = parts.sort((a, b) => a.part - b.part || a.sub.localeCompare(b.sub));
      const chunks = ordered.map((p) => decodeHexPart(fs.readFileSync(p.file, "utf8")));
      const data = Buffer.concat(chunks);
      if (!looksLikeImage(dest, data)) {
        throw new Error(`decoded bytes are not a valid ${path.extname(dest)} file`);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
      hexDests.add(dest);
      count += 1;
      console.log(`decoded ${dest} (${data.length} bytes from ${ordered.length} hex part(s))`);
    } catch (err) {
      console.warn(`skip hex for ${dest}: ${err.message}`);
    }
  }
}

for (const root of roots) {
  const groups = groupByPrefix(walk(root), /^(.*\.b64)(?:\.part(\d+)([a-z])?)?$/);
  for (const [b64Path, parts] of groups) {
    const dest = b64Path.slice(0, -4);
    if (dest.endsWith("favicon.ico")) {
      console.log(`skip sidecar for ${dest}`);
      continue;
    }
    if (hexDests.has(dest)) {
      console.log(`skip b64 for ${dest} (hex sidecar present)`);
      continue;
    }
    try {
      const ordered = parts.sort((a, b) => a.part - b.part || a.sub.localeCompare(b.sub));
      const text = ordered
        .map((p) => fs.readFileSync(p.file, "utf8"))
        .join("")
        .replace(/\s+/g, "");
      const data = Buffer.from(text, "base64");
      if (!looksLikeImage(dest, data)) {
        throw new Error(`decoded bytes are not a valid ${path.extname(dest)} file`);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, data);
      count += 1;
      console.log(`decoded ${dest} (${data.length} bytes from ${ordered.length} b64 part(s))`);
    } catch (err) {
      console.warn(`skip b64 for ${dest}: ${err.message}`);
    }
  }
}

if (count === 0) console.log("no hex/b64 assets to decode");
