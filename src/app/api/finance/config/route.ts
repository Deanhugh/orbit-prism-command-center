import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { booksStatus } from "@/lib/server/bigcapital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await booksStatus();
  return NextResponse.json(status);
}

// Save the Bigcapital base URL, app URL, API key, and optional org id (local secrets).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") setSecret("BIGCAPITAL_API_URL", body.baseUrl.trim());
  if (typeof body.appUrl === "string") setSecret("BIGCAPITAL_APP_URL", body.appUrl.trim());
  if (typeof body.apiKey === "string") setSecret("BIGCAPITAL_API_KEY", body.apiKey.trim());
  if (typeof body.orgId === "string") setSecret("BIGCAPITAL_ORG_ID", body.orgId.trim());
  const status = await booksStatus();
  return NextResponse.json({ ok: true, ...status });
}
