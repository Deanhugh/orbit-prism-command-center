import { NextRequest, NextResponse } from "next/server";
import {
  createEmail,
  emailStatus,
  emailSummary,
  listCampaigns,
  listContacts,
  listEmails,
  listSegments,
} from "@/lib/server/mautic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Aggregate read for the Email board.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const [status, summary, emails, campaigns, segments, contacts] = await Promise.all([
    emailStatus(),
    emailSummary(),
    listEmails({ status: q.get("status") || undefined, search: q.get("search") || undefined, limit: 200 }),
    listCampaigns(),
    listSegments(),
    listContacts({ limit: 50 }),
  ]);
  return NextResponse.json({ status, summary, emails, campaigns, segments, contacts });
}

// Create an email (draft).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const email = await createEmail({
    name,
    subject: body.subject ? String(body.subject) : undefined,
    fromAddress: body.fromAddress ? String(body.fromAddress) : undefined,
    segment: body.segment ? String(body.segment) : undefined,
  });
  return NextResponse.json({ email }, { status: 201 });
}
