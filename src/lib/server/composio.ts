import type { ToolSchema } from "./llm";
import { composioReady, getSecret, loadAgentsConfig } from "./providers";
import { CRM_TOOLS, runCrmTool } from "./twenty";
import { FINANCE_TOOLS, runFinanceTool } from "./bigcapital";
import { PM_TOOLS, runPmTool } from "./plane";
import { SOCIAL_TOOLS, runSocialTool } from "./trypost";
import { EMAIL_TOOLS, runEmailTool } from "./mautic";
import type { Agent } from "../types";

export function composioEnabled(): boolean {
  return composioReady() && loadAgentsConfig().composio;
}

// A small curated tool set per connector, exposed to the model as function tools.
const CONNECTOR_TOOLS: Record<string, { name: string; description: string }[]> = {
  gmail: [
    { name: "gmail_search", description: "Search the inbox for messages matching a query" },
    { name: "gmail_draft", description: "Draft an email (does not send)" },
    { name: "gmail_send", description: "Send an email (requires explicit approval)" },
  ],
  notion: [
    { name: "notion_search", description: "Search Notion pages and databases" },
    { name: "notion_create_page", description: "Create a Notion page" },
  ],
  slack: [{ name: "slack_post", description: "Post a message to a Slack channel" }],
  salesforce: [{ name: "salesforce_list_accounts", description: "List CRM accounts matching filters" }],
  apollo: [{ name: "apollo_search", description: "Find prospects matching an ICP" }],
  clearbit: [{ name: "clearbit_enrich", description: "Enrich a person or company" }],
  linkedin: [{ name: "linkedin_lookup", description: "Look up a LinkedIn profile" }],
  xero: [{ name: "xero_invoices", description: "List or draft invoices" }],
  stripe: [{ name: "stripe_payouts", description: "List Stripe payouts and balances" }],
  meta: [{ name: "meta_campaigns", description: "Read Meta ad campaign performance" }],
  canva: [{ name: "canva_design", description: "Create or fetch a Canva design" }],
  websearch: [{ name: "web_search", description: "Search the web" }],
};

export function toolSchemasForAgent(agent: Agent): ToolSchema[] {
  const schemas: ToolSchema[] = [];
  const keys = agent.tools.map((k) => k.toLowerCase());

  // CRM (Twenty) tools are always available to agents wired to the CRM — they
  // run against a real backend (or the local mock) and don't require Composio.
  if (keys.includes("crm")) {
    for (const t of CRM_TOOLS) {
      schemas.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
  }

  // Finance (Bigcapital) tools — same deal: real backend/mock, no Composio.
  if (keys.includes("bigcapital")) {
    for (const t of FINANCE_TOOLS) {
      schemas.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
  }

  // Project management (Plane) tools — shared by Engineering + PMO agents.
  if (keys.includes("plane")) {
    for (const t of PM_TOOLS) {
      schemas.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
  }

  // Marketing (TryPost) social tools — for the marketing content/social agents.
  if (keys.includes("trypost")) {
    for (const t of SOCIAL_TOOLS) {
      schemas.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
  }

  // Email marketing (Mautic) tools — for the Email Marketing agent.
  if (keys.includes("mautic")) {
    for (const t of EMAIL_TOOLS) {
      schemas.push({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters },
      });
    }
  }

  // Other connector tools are gated behind Composio.
  if (composioEnabled()) {
    for (const key of keys) {
      if (key === "crm" || key === "bigcapital" || key === "plane" || key === "trypost" || key === "mautic") continue;
      for (const t of CONNECTOR_TOOLS[key] || []) {
        schemas.push({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: {
              type: "object",
              properties: { query: { type: "string", description: "input for the tool" } },
            },
          },
        });
      }
    }
  }
  return schemas;
}

/**
 * Execute a tool. Real Composio execution when COMPOSIO_API_KEY is present and
 * the tool resolves; otherwise a graceful simulated result so the flow works.
 */
export async function executeTool(name: string, args: Record<string, unknown>): Promise<string> {
  // CRM tools run against Twenty (live or mock) — real reads/writes on deals.
  if (name.startsWith("crm_")) {
    return runCrmTool(name, args);
  }
  // Finance tools run against Bigcapital (live or mock) — real reads/writes.
  if (name.startsWith("finance_")) {
    return runFinanceTool(name, args);
  }
  // PM tools run against Plane (live or mock) — real reads/writes on work items.
  if (name.startsWith("pm_")) {
    return runPmTool(name, args);
  }
  // Social tools run against TryPost (live or mock) — real reads/writes on posts.
  if (name.startsWith("social_")) {
    return runSocialTool(name, args);
  }
  // Email tools run against Mautic (live or mock) — real reads/writes on emails.
  if (name.startsWith("email_")) {
    return runEmailTool(name, args);
  }
  const key = getSecret("COMPOSIO_API_KEY");
  if (key) {
    try {
      const res = await fetch("https://backend.composio.dev/api/v3/tools/execute/" + encodeURIComponent(name), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": key },
        body: JSON.stringify({ arguments: args }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        return typeof data === "string" ? data : JSON.stringify(data).slice(0, 500);
      }
    } catch {
      /* fall through to simulated */
    }
  }
  // simulated result
  const q = (args.query as string) || "";
  return `${name} ran${q ? ` for "${q}"` : ""} (simulated — connect Composio to run for real).`;
}
