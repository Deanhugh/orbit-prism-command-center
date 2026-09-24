import { NextResponse } from "next/server";
import { emailDiagnostics } from "@/lib/server/mautic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await emailDiagnostics());
}
