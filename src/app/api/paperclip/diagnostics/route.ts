import { NextResponse } from "next/server";
import { paperclipDiagnostics } from "@/lib/server/paperclip";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await paperclipDiagnostics());
}
