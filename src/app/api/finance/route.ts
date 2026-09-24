import { NextRequest, NextResponse } from "next/server";
import {
  booksStatus,
  createInvoice,
  financeSummary,
  listAccounts,
  listBills,
  listInvoices,
  listPayments,
} from "@/lib/server/bigcapital";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate read for the Finance page.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, summary, invoices, bills, payments, accounts] = await Promise.all([
    booksStatus(),
    financeSummary(),
    listInvoices({ status: q.get("status") || undefined, search: q.get("search") || undefined, limit: 300 }),
    listBills({ limit: 300 }),
    listPayments({ limit: 300 }),
    listAccounts({ limit: 500 }),
  ]);
  return NextResponse.json({ status, summary, invoices, bills, payments, accounts });
}

// Create an invoice.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const customerName = String(body.customerName || "").trim();
  if (!customerName) return NextResponse.json({ error: "customerName required" }, { status: 400 });
  const invoice = await createInvoice({
    customerName,
    amount: typeof body.amount === "number" ? body.amount : Number(body.amount) || 0,
    currency: body.currency ? String(body.currency) : undefined,
    dueDate: body.dueDate ? String(body.dueDate) : null,
    status: body.status ? String(body.status) : undefined,
  });
  return NextResponse.json({ invoice }, { status: 201 });
}
