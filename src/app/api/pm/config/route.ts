import { NextRequest, NextResponse } from "next/server";
import { setSecret } from "@/lib/server/providers";
import { planeStatus } from "@/lib/server/plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await planeStatus());
}

// Save the Plane base URL, app URL, API key, and workspace slug (local secrets).
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (typeof body.baseUrl === "string") setSecret("PLANE_API_URL", body.baseUrl.trim());
  if (typeof body.appUrl === "string") setSecret("PLANE_APP_URL", body.appUrl.trim());
  if (typeof body.apiKey === "string") setSecret("PLANE_API_KEY", body.apiKey.trim());
  if (typeof body.workspace === "string") setSecret("PLANE_WORKSPACE_SLUG", body.workspace.trim());
  return NextResponse.json({ ok: true, ...(await planeStatus()) });
}
