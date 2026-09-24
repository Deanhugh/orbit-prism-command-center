import { NextResponse } from "next/server";
import { getSnapshot, refreshMode } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}

export async function POST() {
  await refreshMode();
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot);
}
