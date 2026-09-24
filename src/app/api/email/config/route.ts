import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { emailStatus } from "@/lib/server/mautic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await emailStatus());
}

// Save the Mautic base URL, app URL, and credentials (local secrets).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") setSecret("MAUTIC_API_URL", body.baseUrl.trim());
  if (typeof body.appUrl === "string") setSecret("MAUTIC_APP_URL", body.appUrl.trim());
  if (typeof body.clientId === "string") setSecret("MAUTIC_CLIENT_ID", body.clientId.trim());
  if (typeof body.clientSecret === "string") setSecret("MAUTIC_CLIENT_SECRET", body.clientSecret.trim());
  if (typeof body.basicUser === "string") setSecret("MAUTIC_BASIC_USER", body.basicUser.trim());
  if (typeof body.basicPass === "string") setSecret("MAUTIC_BASIC_PASS", body.basicPass.trim());
  return NextResponse.json({ ok: true, ...(await emailStatus()) });
}
