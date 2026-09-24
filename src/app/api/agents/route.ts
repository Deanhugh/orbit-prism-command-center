import { NextRequest, NextResponse } from "next/server";
import { resetBudget } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id || "");
  const action = body.action as "reset";
  if (!id || action !== "reset") {
    return NextResponse.json({ error: "id and action=reset required" }, { status: 400 });
  }
  const agent = resetBudget(id);
  return NextResponse.json({ agent });
}
