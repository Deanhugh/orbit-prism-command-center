import { NextResponse } from "next/server";
import { booksDiagnostics } from "@/lib/server/bigcapital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Probes the live Bigcapital endpoints so we can validate/tune the mappers once
// a real instance is connected.
export async function GET() {
  return NextResponse.json(await booksDiagnostics());
}
