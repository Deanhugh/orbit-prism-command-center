#!/usr/bin/env node
// Render the workflow Markdown guide to a styled PDF using headless Chrome.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { marked } from "marked";

const root = process.cwd();
const mdPath = path.join(root, "public", "Orbit-Prism-Skills-Workflow.md");
const pdfPath = path.join(root, "public", "Orbit-Prism-Skills-Workflow.pdf");
const md = fs.readFileSync(mdPath, "utf8");
const bodyHtml = marked.parse(md);

const html = `<!doctype html><html><head><meta charset="utf-8">
<style>
  @page { size: A4; margin: 20mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
         color: #23201b; font-size: 11.5px; line-height: 1.55; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 24px; margin: 0 0 4px;
       color: #1c1a16; border-bottom: 3px solid #c98a3a; padding-bottom: 8px; }
  h2 { font-family: Georgia, serif; font-size: 16px; margin: 22px 0 6px; color: #2b2823;
       border-bottom: 1px solid #e0d8c6; padding-bottom: 3px; }
  h3 { font-size: 13px; margin: 14px 0 4px; }
  p, li { color: #34302a; }
  code { background: #f1ece0; padding: 1px 4px; border-radius: 3px; font-size: 10.5px;
         font-family: ui-monospace, Menlo, Consolas, monospace; }
  pre { background: #f6f1e6; border: 1px solid #e2d9c6; border-radius: 6px; padding: 10px 12px;
        overflow-x: auto; page-break-inside: avoid; }
  pre code { background: none; padding: 0; font-size: 10px; line-height: 1.45; }
  table { border-collapse: collapse; width: 100%; margin: 10px 0; page-break-inside: avoid; }
  th, td { border: 1px solid #ddd3bf; padding: 4px 8px; text-align: left; font-size: 10.5px; }
  th { background: #efe7d4; font-weight: 700; }
  tr:nth-child(even) td { background: #faf7f0; }
  blockquote { margin: 10px 0; padding: 6px 12px; border-left: 3px solid #c98a3a;
               background: #faf6ec; color: #5a5348; }
  a { color: #b06a1e; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e0d8c6; margin: 18px 0; }
  h2 { page-break-after: avoid; }
</style></head><body>${bodyHtml}</body></html>`;

const tmpHtml = path.join(os.tmpdir(), "orbit-workflow.html");
fs.writeFileSync(tmpHtml, html);

const chromeCandidates = [
  "/usr/local/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/opt/google/chrome/chrome",
  process.env.CHROME_PATH,
].filter(Boolean);
const chrome = chromeCandidates.find((c) => fs.existsSync(c));
if (!chrome) {
  console.error("No Chrome found. Set CHROME_PATH.");
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-pdf-"));
try {
  fs.rmSync(pdfPath, { force: true });
} catch {
  /* ignore */
}

try {
  execFileSync(
    chrome,
    [
      "--headless=old",
      "--disable-gpu",
      "--no-sandbox",
      "--no-pdf-header-footer",
      `--user-data-dir=${profile}`,
      `--print-to-pdf=${pdfPath}`,
      `file://${tmpHtml}`,
    ],
    { stdio: "inherit", timeout: 20000 },
  );
} catch {
  // some Chrome builds don't exit cleanly; the PDF is still written.
}

if (!fs.existsSync(pdfPath)) {
  console.error("PDF was not produced.");
  process.exit(1);
}
const kb = Math.round(fs.statSync(pdfPath).size / 1024);
console.log(`✓ Wrote ${path.relative(root, pdfPath)} (${kb} KB)`);
