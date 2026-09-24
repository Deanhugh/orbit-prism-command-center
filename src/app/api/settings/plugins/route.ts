import { NextResponse } from "next/server";
import { composioReady, loadAgentsConfig } from "@/lib/server/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Curated plugin catalog (Composio toolkits + local capabilities).
const CATALOG = [
  { id: "gmail", label: "Gmail", via: "composio" },
  { id: "slack", label: "Slack", via: "composio" },
  { id: "notion", label: "Notion", via: "composio" },
  { id: "salesforce", label: "Salesforce", via: "composio" },
  { id: "linkedin", label: "LinkedIn", via: "composio" },
  { id: "hubspot", label: "HubSpot", via: "composio" },
  { id: "googlecalendar", label: "Google Calendar", via: "composio" },
  { id: "websearch", label: "Web Search", via: "native" },
];

export async function GET() {
  const cfg = loadAgentsConfig();
  const ready = composioReady();
  return NextResponse.json({
    composioReady: ready,
    composioEnabled: cfg.composio,
    catalog: CATALOG.map((c) => ({
      ...c,
      status: c.via === "native" ? "available" : ready && cfg.composio ? "connected" : "needs Composio",
    })),
  });
}
