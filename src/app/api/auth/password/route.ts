import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";
import { changePassword } from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    current?: string;
    next?: string;
    confirm?: string;
  };
  if ((body.next || "") !== (body.confirm || "")) {
    return NextResponse.json({ error: "New password and confirmation do not match." }, { status: 400 });
  }
  const result = changePassword(user.id, String(body.current || ""), String(body.next || ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
