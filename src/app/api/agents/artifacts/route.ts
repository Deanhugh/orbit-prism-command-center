import { NextRequest, NextResponse } from "next/server";
import {
  artifactCsv,
  artifactHtml,
  artifactPdf,
  readArtifact,
  saveArtifact,
  wordDoc,
} from "@/lib/server/artifacts";
import type { ArtifactKind } from "@/lib/artifacts";
import { inferArtifactKind } from "@/lib/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const markdown = String(body.markdown || "").trim();
  if (!markdown) return NextResponse.json({ error: "markdown required" }, { status: 400 });
  const kind = (body.kind as ArtifactKind) || inferArtifactKind(String(body.prompt || ""), markdown) || "document";
  const meta = saveArtifact({
    title: typeof body.title === "string" ? body.title : undefined,
    markdown,
    kind,
    convId: typeof body.convId === "string" ? body.convId : undefined,
    videoUrl: typeof body.videoUrl === "string" ? body.videoUrl : undefined,
  });
  return NextResponse.json({ artifact: meta });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || "";
  const format = (req.nextUrl.searchParams.get("format") || "json").toLowerCase();
  const meta = readArtifact(id);
  if (!meta) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (format === "json") return NextResponse.json({ artifact: meta });

  const safe = meta.title.replace(/[^\w.-]+/g, "_").slice(0, 60) || "deliverable";
  if (format === "html" || format === "preview" || format === "pptx") {
    const html = artifactHtml(meta);
    const filename = format === "pptx" ? `${safe}.html` : `${safe}.html`;
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": format === "preview" ? "inline" : `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "pdf") {
    const pdf = artifactPdf(meta);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${safe}.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "doc" || format === "docx" || format === "word") {
    const doc = wordDoc(meta);
    return new Response(new Uint8Array(doc), {
      headers: {
        "Content-Type": "application/msword",
        "Content-Disposition": `attachment; filename="${safe}.doc"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "csv" || format === "xlsx" || format === "xls") {
    const csv = artifactCsv(meta);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safe}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }
  if (format === "md") {
    return new Response(meta.markdown, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safe}.md"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return NextResponse.json({ error: "unknown format" }, { status: 400 });
}
