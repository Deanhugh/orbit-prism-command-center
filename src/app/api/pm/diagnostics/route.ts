import { NextResponse } from "next/server";
import { planeDiagnostics } from "@/lib/server/plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await planeDiagnostics());
}
