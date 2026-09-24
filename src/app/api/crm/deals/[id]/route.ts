import { NextRequest, NextResponse } from "next/server";
import { getDeal, updateDeal } from "@/lib/server/twenty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await getDeal(id);
  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deal });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const deal = await updateDeal(id, {
    name: body.name !== undefined ? String(body.name) : undefined,
    amount: body.amount !== undefined ? Number(body.amount) : undefined,
    currency: body.currency !== undefined ? String(body.currency) : undefined,
    stage: body.stage !== undefined ? String(body.stage) : undefined,
    closeDate: body.closeDate !== undefined ? String(body.closeDate) : undefined,
  });
  if (!deal) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deal });
}
