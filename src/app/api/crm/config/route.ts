import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { crmStatus } from "@/lib/server/twenty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await crmStatus();
  return NextResponse.json(status);
}

// Save the Twenty base URL, app URL, and/or API key (stored locally in data/secrets.json).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") {
    setSecret("TWENTY_API_URL", body.baseUrl.trim());
  }
  if (typeof body.appUrl === "string") {
    setSecret("TWENTY_APP_URL", body.appUrl.trim());
  }
  if (typeof body.apiKey === "string") {
    setSecret("TWENTY_API_KEY", body.apiKey.trim());
  }
  const status = await crmStatus();
  return NextResponse.json({ ok: true, ...status });
}
