import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const wantPdf = req.nextUrl.searchParams.get("format") === "pdf";
  const filename = wantPdf
    ? "Orbit-Prism-Skills-Workflow.pdf"
    : "Orbit-Prism-Skills-Workflow.md";
  const file = path.join(process.cwd(), "public", filename);

  try {
    const body = fs.readFileSync(file);
    return new Response(new Uint8Array(body), {
      headers: {
        "Content-Type": wantPdf
          ? "application/pdf"
          : "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
