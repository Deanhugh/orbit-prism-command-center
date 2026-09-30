import fs from "node:fs";
import path from "node:path";
import { shortId } from "../utils";
import { dataDir } from "./config";
import type { ArtifactKind, ArtifactMeta } from "../artifacts";
import { extractVideoUrl, titleFromMarkdown } from "../artifacts";

function dir() {
  return path.join(dataDir(), "artifacts");
}

function fileFor(id: string) {
  return path.join(dir(), `${id.replace(/[^a-z0-9_-]/gi, "_")}.json`);
}

export function saveArtifact(input: {
  title?: string;
  markdown: string;
  kind: ArtifactKind;
  convId?: string;
  videoUrl?: string;
}): ArtifactMeta {
  fs.mkdirSync(dir(), { recursive: true });
  const markdown = (input.markdown.trim() || "Empty deliverable.") + "\n";
  const id = shortId("art");
  const meta: ArtifactMeta = {
    id,
    title: (input.title || titleFromMarkdown(markdown)).slice(0, 80),
    kind: input.kind,
    markdown,
    videoUrl: input.videoUrl || extractVideoUrl(markdown),
    createdAt: Date.now(),
    convId: input.convId,
  };
  fs.writeFileSync(fileFor(id), JSON.stringify(meta, null, 2));
  return meta;
}

export function readArtifact(id: string): ArtifactMeta | null {
  try {
    return JSON.parse(fs.readFileSync(fileFor(id), "utf8")) as ArtifactMeta;
  } catch {
    return null;
  }
}

export function markdownToHtml(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inList = false;
  let inCode = false;
  let inTable = false;
  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (inCode) {
        out.push("</code></pre>");
        inCode = false;
      } else {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push("<pre><code>");
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      out.push(`${esc(raw)}\n`);
      continue;
    }
    if (/^\|.+\|$/.test(raw.trim())) {
      const cells = raw.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (/^[-:| ]+$/.test(cells.join(""))) continue;
      if (!inTable) {
        if (inList) {
          out.push("</ul>");
          inList = false;
        }
        out.push("<table>");
        inTable = true;
        out.push("<thead><tr>" + cells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>");
      } else {
        out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      }
      continue;
    }
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
    const h = raw.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      continue;
    }
    if (/^[-*]\s+/.test(raw)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${inline(raw.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    if (!raw.trim()) {
      out.push("");
      continue;
    }
    out.push(`<p>${inline(raw)}</p>`);
  }
  if (inCode) out.push("</code></pre>");
  if (inList) out.push("</ul>");
  if (inTable) out.push("</tbody></table>");
  return out.join("\n");

  function inline(s: string) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }
}

const DOC_CSS = `
  body { font-family: Georgia, "Times New Roman", serif; color: #1c1a16; margin: 36px 40px; line-height: 1.5; }
  h1 { font-size: 28px; letter-spacing: 0.12em; text-transform: uppercase; font-weight: 400; }
  h2 { font-size: 18px; margin-top: 28px; }
  h3 { font-size: 14px; }
  p, li { font-size: 13px; color: #2b2823; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  th, td { border: 1px solid #ddd3bf; padding: 6px 8px; text-align: left; font-size: 12px; }
  th { background: #efe7d4; }
  pre { background: #f6f1e6; padding: 10px; overflow: auto; }
  code { font-family: ui-monospace, Menlo, monospace; font-size: 12px; }
`;

export function wrapHtml(title: string, body: string, extraCss = ""): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeAttr(title)}</title>
<style>${DOC_CSS}${extraCss}</style></head><body>${body}</body></html>`;
}

function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function artifactHtml(meta: ArtifactMeta): string {
  if (meta.kind === "slides") return slidesHtml(meta);
  return wrapHtml(meta.title, `<h1>${escapeAttr(meta.title)}</h1>${markdownToHtml(meta.markdown)}`);
}

function slidesHtml(meta: ArtifactMeta): string {
  const parts = meta.markdown.split(/^##\s+/m).filter((p) => p.trim());
  const slides = (parts.length ? parts : [meta.markdown]).map((block, i) => {
    const lines = block.trim().split("\n");
    const heading = i === 0 && !meta.markdown.startsWith("##") ? meta.title : lines[0];
    const rest = (i === 0 && !meta.markdown.startsWith("##") ? lines : lines.slice(1)).join("\n");
    return `<section class="slide"><h1>${escapeAttr(heading.replace(/^#+\s*/, ""))}</h1>${markdownToHtml(rest)}</section>`;
  });
  const css = `
    body { margin: 0; background: #0a0514; color: #fff; }
    .slide { min-height: 100vh; padding: 64px 72px; box-sizing: border-box; page-break-after: always; border-bottom: 1px solid #2c2331; }
    h1 { font-family: Inter, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
    p, li { color: #c9c2b8; }
  `;
  return wrapHtml(meta.title, slides.join("\n"), css);
}

export function artifactCsv(meta: ArtifactMeta): string {
  const tables = [...meta.markdown.replace(/\r\n/g, "\n").matchAll(/((?:^\|.+\|\n)+)/gm)];
  if (tables.length) {
    const rows: string[] = [];
    for (const t of tables) {
      for (const line of t[1].trim().split("\n")) {
        const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
        if (/^[-:]+$/.test(cells.join("").replace(/\|/g, ""))) continue;
        rows.push(cells.map(csvCell).join(","));
      }
      rows.push("");
    }
    return rows.join("\n");
  }
  return meta.markdown
    .split("\n")
    .map((l) => csvCell(l.replace(/^#+\s*/, "").trim()))
    .filter(Boolean)
    .join("\n");
}

function csvCell(s: string) {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Minimal multi-page Helvetica PDF from plain text. */
export function artifactPdf(meta: ArtifactMeta): Buffer {
  const text = meta.markdown.replace(/\r\n/g, "\n");
  const lines: string[] = [];
  for (const para of text.split("\n")) {
    const wrapped = wrapLine(para.replace(/\t/g, "  "), 92);
    if (!wrapped.length) lines.push("");
    else lines.push(...wrapped);
  }
  const perPage = 52;
  const pages: string[][] = [];
  for (let i = 0; i < lines.length; i += perPage) pages.push(lines.slice(i, i + perPage));
  if (!pages.length) pages.push([meta.title]);

  const objs: string[] = [];
  objs.push("<< /Type /Catalog /Pages 2 0 R >>");
  objs.push(""); // pages dict filled below
  const pageIds: number[] = [];
  const contentIds: number[] = [];
  pages.forEach(() => {
    contentIds.push(0);
    pageIds.push(0);
  });
  // placeholders filled after we know ids
  const pageObjStart = 3;
  pages.forEach((_, i) => {
    const contentId = pageObjStart + i * 2;
    const pageId = contentId + 1;
    contentIds[i] = contentId;
    pageIds[i] = pageId;
  });
  const kids = pageIds.map((id) => `${id} 0 R`).join(" ");
  objs[1] = `<< /Type /Pages /Count ${pages.length} /Kids [${kids}] >>`;

  const fontId = pageObjStart + pages.length * 2;

  function objBuf(id: number, raw: string) {
    return Buffer.from(`${id} 0 obj\n${raw}\nendobj\n`, "utf8");
  }

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n", "utf8")];
  let pos = parts[0].length;
  const index: number[] = [];

  function pushObj(id: number, raw: string) {
    index[id] = pos;
    const b = objBuf(id, raw);
    parts.push(b);
    pos += b.length;
  }

  pushObj(1, objs[0]);
  pushObj(2, objs[1]);

  pages.forEach((pageLines, i) => {
    const stream = pageStream(meta.title, pageLines, i + 1, pages.length);
    const contentId = contentIds[i];
    const pageId = pageIds[i];
    pushObj(contentId, `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    pushObj(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
  });
  pushObj(fontId, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  const xrefPos = pos;
  let xref = `xref\n0 ${fontId + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= fontId; i++) {
    xref += `${String(index[i]).padStart(10, "0")} 00000 n \n`;
  }
  const xrefBuf = Buffer.from(xref, "utf8");
  parts.push(xrefBuf);
  pos += xrefBuf.length;
  const trailer = Buffer.from(
    `trailer\n<< /Size ${fontId + 1} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`,
    "utf8",
  );
  parts.push(trailer);
  return Buffer.concat(parts);
}

function pageStream(title: string, lines: string[], page: number, total: number): string {
  const cmds: string[] = ["BT", "/F1 11 Tf", "32 TL"];
  cmds.push(`1 0 0 1 48 748 Tm (${pdfEsc(title.slice(0, 70))}) Tj`);
  cmds.push("/F1 9 Tf");
  cmds.push("0 -22 Td");
  for (const line of lines) {
    cmds.push(`(${pdfEsc(line)}) Tj`);
    cmds.push("T*");
  }
  cmds.push("/F1 8 Tf");
  cmds.push(`1 0 0 1 520 28 Tm (${page} / ${total}) Tj`);
  cmds.push("ET");
  return cmds.join("\n");
}

function pdfEsc(s: string) {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, (ch) => {
      const c = ch.charCodeAt(0);
      return c < 256 ? `\\${c.toString(8).padStart(3, "0")}` : "?";
    });
}

function wrapLine(s: string, width: number): string[] {
  if (!s) return [""];
  const out: string[] = [];
  let cur = s;
  while (cur.length > width) {
    let cut = cur.lastIndexOf(" ", width);
    if (cut < 20) cut = width;
    out.push(cur.slice(0, cut));
    cur = cur.slice(cut).trimStart();
  }
  if (cur) out.push(cur);
  return out;
}

export function wordDoc(meta: ArtifactMeta): Buffer {
  return Buffer.from(artifactHtml(meta), "utf8");
}
