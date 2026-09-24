import { NextRequest, NextResponse } from "next/server";
import {
  createDeal,
  crmStatus,
  listCompanies,
  listDeals,
  listPeople,
  pipelineSummary,
} from "@/lib/server/twenty";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate read for the CRM board.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, deals, companies, people, summary] = await Promise.all([
    crmStatus(),
    listDeals({ stage: q.get("stage") || undefined, search: q.get("search") || undefined, limit: 200 }),
    listCompanies({ limit: 200 }),
    listPeople({ limit: 200 }),
    pipelineSummary(),
  ]);
  return NextResponse.json({ status, deals, companies, people, summary });
}

// Create a deal.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const deal = await createDeal({
    name,
    amount: typeof body.amount === "number" ? body.amount : Number(body.amount) || undefined,
    currency: body.currency ? String(body.currency) : undefined,
    stage: body.stage ? String(body.stage) : undefined,
    closeDate: body.closeDate ? String(body.closeDate) : null,
    companyId: body.companyId ? String(body.companyId) : null,
    contactId: body.contactId ? String(body.contactId) : null,
  });
  return NextResponse.json({ deal }, { status: 201 });
}
