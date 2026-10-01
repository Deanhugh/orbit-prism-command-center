import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import ExcelJS from "exceljs";
import PptxGenJS from "pptxgenjs";
import type { ArtifactMeta } from "../artifacts";

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];

type MdBlock =
  | { type: "h"; level: 1 | 2 | 3; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "code"; text: string }
  | { type: "table"; rows: string[][] };

function asBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data instanceof Uint8Array) return Buffer.from(data);
  throw new Error("office export did not return a binary buffer");
}

function stripMd(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/`(.+?)`/g, "$1")
    .replace(/^#+\s*/, "")
    .trim();
}

function parseBlocks(md: string): MdBlock[] {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: MdBlock[] = [];
  let inCode = false;
  const code: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;

  const flushList = () => {
    if (list) {
      out.push(list);
      list = null;
    }
  };
  const flushTable = () => {
    if (table?.length) out.push({ type: "table", rows: table });
    table = null;
  };

  for (const raw of lines) {
    if (raw.startsWith("```")) {
      if (inCode) {
        out.push({ type: "code", text: code.join("\n") });
        code.length = 0;
        inCode = false;
      } else {
        flushList();
        flushTable();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(raw);
      continue;
    }
    if (/^\|.+\|$/.test(raw.trim())) {
      flushList();
      const cells = raw.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (/^[-:| ]+$/.test(cells.join(""))) continue;
      if (!table) table = [];
      table.push(cells);
      continue;
    }
    if (table) flushTable();

    const h = raw.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushList();
      out.push({ type: "h", level: h[1].length as 1 | 2 | 3, text: h[2].trim() });
      continue;
    }
    if (/^[-*]\s+/.test(raw)) {
      if (list?.type !== "ul") {
        flushList();
        list = { type: "ul", items: [] };
      }
      list.items.push(raw.replace(/^[-*]\s+/, ""));
      continue;
    }
    if (/^\d+\.\s+/.test(raw)) {
      if (list?.type !== "ol") {
        flushList();
        list = { type: "ol", items: [] };
      }
      list.items.push(raw.replace(/^\d+\.\s+/, ""));
      continue;
    }
    flushList();
    if (!raw.trim() || /^---+$/.test(raw.trim())) continue;
    out.push({ type: "p", text: raw });
  }
  if (inCode) out.push({ type: "code", text: code.join("\n") });
  flushList();
  flushTable();
  return out;
}

function inlineRuns(text: string): TextRun[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter((p) => p.length);
  if (!parts.length) return [new TextRun("")];
  return parts.map((p) => {
    if (p.startsWith("**") && p.endsWith("**")) {
      return new TextRun({ text: p.slice(2, -2), bold: true });
    }
    if (p.startsWith("*") && p.endsWith("*")) {
      return new TextRun({ text: p.slice(1, -1), italics: true });
    }
    if (p.startsWith("`") && p.endsWith("`")) {
      return new TextRun({ text: p.slice(1, -1), font: "Courier New" });
    }
    return new TextRun(p);
  });
}

function wordTable(rows: string[][]): Table {
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const border = { style: BorderStyle.SINGLE, size: 4, color: "D4C9B0" };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: rows.map(
      (row, ri) =>
        new TableRow({
          children: Array.from({ length: cols }, (_, ci) => {
            const cell = row[ci] || "";
            return new TableCell({
              shading: ri === 0 ? { fill: "EFE7D4" } : undefined,
              children: [
                new Paragraph({
                  children: inlineRuns(cell),
                }),
              ],
            });
          }),
        }),
    ),
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
  });
}

function headingStyle(level: 1 | 2 | 3): HeadingLevelValue {
  if (level === 1) return HeadingLevel.HEADING_1;
  if (level === 2) return HeadingLevel.HEADING_2;
  return HeadingLevel.HEADING_3;
}

export async function artifactDocx(meta: ArtifactMeta): Promise<Buffer> {
  const children: (Paragraph | Table)[] = [
    new Paragraph({
      text: meta.title,
      heading: HeadingLevel.TITLE,
    }),
  ];
  for (const block of parseBlocks(meta.markdown)) {
    if (block.type === "h") {
      children.push(
        new Paragraph({
          children: inlineRuns(block.text),
          heading: headingStyle(block.level),
        }),
      );
    } else if (block.type === "p") {
      children.push(new Paragraph({ children: inlineRuns(block.text) }));
    } else if (block.type === "ul") {
      for (const item of block.items) {
        children.push(new Paragraph({ children: inlineRuns(item), bullet: { level: 0 } }));
      }
    } else if (block.type === "ol") {
      for (const item of block.items) {
        children.push(new Paragraph({ children: inlineRuns(item), numbering: { reference: "export-num", level: 0 } }));
      }
    } else if (block.type === "code") {
      for (const line of (block.text || " ").split("\n")) {
        children.push(
          new Paragraph({
            children: [new TextRun({ text: line || " ", font: "Courier New", size: 20 })],
          }),
        );
      }
    } else if (block.type === "table") {
      children.push(wordTable(block.rows));
    }
  }
  const doc = new Document({
    title: meta.title,
    creator: "Orbit Prism Command Center",
    numbering: {
      config: [
        {
          reference: "export-num",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  return asBuffer(await Packer.toBuffer(doc));
}

function addSheetFromRows(wb: ExcelJS.Workbook, name: string, rows: string[][]) {
  const ws = wb.addWorksheet(name.slice(0, 31) || "Sheet");
  for (const [i, row] of rows.entries()) {
    const added = ws.addRow(row.map(stripMd));
    if (i === 0) {
      added.font = { bold: true };
      added.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEFE7D4" },
      };
    }
  }
  ws.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const n = String(cell.value ?? "").length + 2;
      if (n > max) max = n;
    });
    col.width = Math.min(48, max);
  });
}

export async function artifactXlsx(meta: ArtifactMeta): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Orbit Prism Command Center";
  wb.title = meta.title;
  const tables = parseBlocks(meta.markdown).filter((b): b is Extract<MdBlock, { type: "table" }> => b.type === "table");
  if (tables.length) {
    tables.forEach((t, i) => addSheetFromRows(wb, tables.length === 1 ? "Sheet1" : `Table ${i + 1}`, t.rows));
  } else {
    const rows: string[][] = [[meta.title]];
    for (const block of parseBlocks(meta.markdown)) {
      if (block.type === "h") rows.push([stripMd(block.text)]);
      else if (block.type === "p") rows.push([stripMd(block.text)]);
      else if (block.type === "ul" || block.type === "ol") {
        for (const item of block.items) rows.push([stripMd(item)]);
      } else if (block.type === "code") {
        for (const line of block.text.split("\n")) rows.push([line]);
      }
    }
    addSheetFromRows(wb, "Sheet1", rows);
  }
  return asBuffer(await wb.xlsx.writeBuffer());
}

function slideSections(meta: ArtifactMeta): { heading: string; body: string[] }[] {
  const md = meta.markdown.replace(/\r\n/g, "\n").trim();
  const parts = md.split(/^##\s+/m).filter((p) => p.trim());
  const sections = (parts.length ? parts : [md]).map((block, i) => {
    const lines = block.trim().split("\n");
    const heading =
      i === 0 && !md.startsWith("##") ? meta.title : stripMd(lines[0] || meta.title);
    const rest = (i === 0 && !md.startsWith("##") ? lines : lines.slice(1)).join("\n");
    const body: string[] = [];
    for (const b of parseBlocks(rest)) {
      if (b.type === "p" || b.type === "h") {
        const t = stripMd(b.type === "h" ? b.text : b.text);
        if (t) body.push(t);
      } else if (b.type === "ul" || b.type === "ol") {
        body.push(...b.items.map(stripMd).filter(Boolean));
      } else if (b.type === "table") {
        body.push(...b.rows.map((r) => r.map(stripMd).join(" · ")));
      }
    }
    return { heading, body: body.slice(0, 10) };
  });
  return sections.slice(0, 24);
}

export async function artifactPptx(meta: ArtifactMeta): Promise<Buffer> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = meta.title;
  pptx.author = "Orbit Prism Command Center";
  pptx.subject = meta.title;
  const slides = slideSections(meta);
  for (const section of slides) {
    const slide = pptx.addSlide();
    slide.background = { color: "0A0514" };
    slide.addText(section.heading || meta.title, {
      x: 0.55,
      y: 0.35,
      w: 12.2,
      h: 1.05,
      fontSize: 28,
      bold: true,
      color: "FFFFFF",
      fontFace: "Calibri",
    });
    if (section.body.length) {
      slide.addText(
        section.body.map((line) => ({
          text: line,
          options: { bullet: true, breakLine: true },
        })),
        {
          x: 0.6,
          y: 1.55,
          w: 12.1,
          h: 5.4,
          fontSize: 18,
          color: "C9C2B8",
          fontFace: "Calibri",
          valign: "top",
        },
      );
    }
  }
  if (!slides.length) {
    const slide = pptx.addSlide();
    slide.background = { color: "0A0514" };
    slide.addText(meta.title, {
      x: 0.55,
      y: 2.8,
      w: 12.2,
      h: 1.2,
      fontSize: 32,
      bold: true,
      color: "FFFFFF",
      align: "center",
    });
  }
  return asBuffer(await pptx.write({ outputType: "nodebuffer" }));
}
