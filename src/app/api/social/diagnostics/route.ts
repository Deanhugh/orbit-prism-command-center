import { NextResponse } from "next/server";
import { socialDiagnostics } from "@/lib/server/trypost";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await socialDiagnostics());
}
