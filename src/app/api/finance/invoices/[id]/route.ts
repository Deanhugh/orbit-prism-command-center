import { NextRequest, NextResponse } from "next/server";
import { getInvoice, updateInvoice } from "@/lib/server/bigcapital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const invoice = await updateInvoice(id, {
    status: body.status !== undefined ? String(body.status) : undefined,
    amount: body.amount !== undefined ? Number(body.amount) : undefined,
    dueDate: body.dueDate !== undefined ? String(body.dueDate) : undefined,
  });
  if (!invoice) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ invoice });
}
