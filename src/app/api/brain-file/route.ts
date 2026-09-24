import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { brainDir } from "@/lib/server/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".avif": "image/avif",
  ".pdf": "application/pdf",
};

export async function GET(req: NextRequest) {
  const rel = req.nextUrl.searchParams.get("path") || "";
  if (!rel) return new Response("path required", { status: 400 });

  const roots = [brainDir(), process.cwd()];
  for (const root of roots) {
    const full = path.resolve(root, rel);
    // prevent path traversal outside the allowed root
    if (!full.startsWith(path.resolve(root))) continue;
    try {
      const data = fs.readFileSync(full);
      const ext = path.extname(full).toLowerCase();
      return new Response(new Uint8Array(data), {
        headers: {
          "Content-Type": MIME[ext] || "application/octet-stream",
          "Cache-Control": "no-store",
        },
      });
    } catch {
      /* try next root */
    }
  }
  return new Response("not found", { status: 404 });
}
