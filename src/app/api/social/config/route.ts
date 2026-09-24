import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { socialStatus } from "@/lib/server/trypost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await socialStatus());
}

// Save the TryPost base URL, app URL, and API key (stored locally in data/secrets.json).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") setSecret("TRYPOST_API_URL", body.baseUrl.trim());
  if (typeof body.appUrl === "string") setSecret("TRYPOST_APP_URL", body.appUrl.trim());
  if (typeof body.apiKey === "string") setSecret("TRYPOST_API_KEY", body.apiKey.trim());
  return NextResponse.json({ ok: true, ...(await socialStatus()) });
}
