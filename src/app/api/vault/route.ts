import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifyToken } from "@/lib/server/auth";
import { loadVaultConfig, saveVaultConfig } from "@/lib/server/vault-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(loadVaultConfig());
}

export async function PUT(req: NextRequest) {
  const userId = verifyToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const saved = saveVaultConfig({
    commands: body.commands || [],
    channels: body.channels || [],
  });
  return NextResponse.json(saved);
}
