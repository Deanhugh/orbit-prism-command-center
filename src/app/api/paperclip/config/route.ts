import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { paperclipStatus } from "@/lib/server/paperclip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await paperclipStatus());
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") setSecret("PAPERCLIP_API_URL", body.baseUrl.trim());
  if (typeof body.appUrl === "string") setSecret("PAPERCLIP_APP_URL", body.appUrl.trim());
  if (typeof body.apiKey === "string") setSecret("PAPERCLIP_API_KEY", body.apiKey.trim());
  if (typeof body.companyId === "string") setSecret("PAPERCLIP_COMPANY_ID", body.companyId.trim());
  return NextResponse.json({ ok: true, ...(await paperclipStatus()) });
}
