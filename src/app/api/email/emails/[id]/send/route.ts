import { NextRequest, NextResponse } from "next/server";
import { sendEmail } from "@/lib/server/mautic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const email = await sendEmail(id);
  if (!email) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ email });
}
