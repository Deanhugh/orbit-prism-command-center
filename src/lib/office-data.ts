import type { Agent, Connector, Department, DeptId } from "./types";

export const OFFICE_NAME = "Orbit Prism Operating System";
export const STUDIO_NAME = "Northwind Atelier";

export const JARVIS = {
  id: "jarvis",
  name: "JARVIS",
  role: "Chief of Staff",
  does: "Runs the whole office — takes your intent, routes every request to the right desk through the department leads, holds them accountable, and escalates only what needs you.",
};

export const DEPARTMENTS: Department[] = [
  {
    id: "marketing",
    name: "Marketing",
    accent: "#e0567a",
    seats: 6,
    angle: Math.PI * 1.0,
    metrics: [
      { label: "New insights", value: "3" },
      { label: "Cost per lead", value: "$41" },
    ],
  },
  {
    id: "emails",
    name: "(PMO) Project Management Office",
    accent: "#4a9e6f",
    seats: 5,
    angle: Math.PI * 1.5,
    metrics: [
      { label: "Active projects", value: "12" },
      { label: "On time", value: "11 / 12" },
    ],
  },
  {
    id: "delivery",
    name: "Account Management",
    accent: "#3f8f7a",
    seats: 7,
    angle: Math.PI * 0.5,
    metrics: [
      { label: "Portfolio accounts", value: "24" },
      { label: "Retention", value: "96%" },
    ],
  },
  {
    id: "sales",
    name: "Sales",
    accent: "#2b2823",
    seats: 6,
    angle: Math.PI * 0.0,
    metrics: [
      { label: "Deals in pipeline", value: "18" },
      { label: "Closed this month", value: "7" },
    ],
  },
  {
    id: "ops",
    name: "Engineering",
    accent: "#8a6bd0",
    seats: 5,
    angle: Math.PI * 1.25,
    metrics: [
      { label: "Agents shipped", value: "9" },
      { label: "Systems live", value: "6" },
    ],
  },
  {
    id: "finance",
    name: "Finance",
    accent: "#c98a3a",
    seats: 4,
    angle: Math.PI * 0.75,
    metrics: [
      { label: "Invoices issued", value: "23" },
      { label: "Bills paid", value: "14" },
    ],
  },
];

export const DEPT_MAP: Record<DeptId, Department> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, d]),
) as Record<DeptId, Department>;

export const AGENTS: Agent[] = [
  a("mk_research", "marketing", false, "RESEARCH", "Research Agent", "Scans the market, audience and competitors every day and files what changed — the insight the rest of marketing runs on. Reports to the Chief of Staff.", ["websearch", "notion"]),
  a("mk_ads", "marketing", false, "AEO / SEO", "AEO & SEO Agent", "Owns search and answer-engine visibility — keywords, technical SEO, and content that ranks and gets cited. Reports to the Chief of Staff.", ["websearch", "notion"]),
  a("mk_gfx", "marketing", false, "BRAND", "Brand Agent", "Guards the brand — voice, look, and one consistent identity across every asset. Reports to the Chief of Staff.", ["trypost", "canva", "notion"]),
  a("mk_lead", "marketing", false, "CONTENT STRATEGIST", "Content Strategist", "Owns the content calendar and strategy — turns positioning into a pipeline of content that performs. Reports to the Chief of Staff.", ["trypost", "notion", "canva"]),
  a("mk_news", "marketing", false, "EMAIL MARKETING", "Email Marketing Agent", "Runs lifecycle and newsletter email — campaigns, sequences, and the note subscribers actually open. Reports to the Chief of Staff.", ["mautic", "gmail"]),
  a("mk_social", "marketing", false, "SOCIAL MEDIA", "Social Media Strategist", "Runs the social engine across channels — hooks, reels, carousels, and the posting calendar. Reports to the Chief of Staff.", ["trypost", "canva", "notion"]),
  a("em_lead", "emails", true, "PROGRAM MANAGER", "Program Manager", "Owns every project portfolio and leads all the project managers — sets priorities, staffing, and timelines, and reports portfolio status to the Chief of Staff.", ["plane", "notion", "gmail"]),
  a("em_client", "emails", false, "PROJECT MANAGER", "Project Manager", "Owns a portfolio of client projects end to end — scope, plan, milestones, and on-time delivery.", ["plane", "notion", "gmail"]),
  a("em_internal", "emails", false, "PROJECT MANAGER", "Project Manager", "Drives day-to-day delivery across a portfolio of projects — status, sign-offs, and hours; moves things before they slip.", ["plane", "notion", "gmail"]),
  a("em_vendor", "emails", false, "PROJECT MANAGER", "Project Manager", "Runs a portfolio of projects with a close eye on risks, blockers, and dependencies; escalates early.", ["plane", "notion", "gmail"]),
  a("em_partner", "emails", false, "PROJECT MANAGER", "Project Manager", "Manages a portfolio of projects and the people on them — capacity, resourcing, and conflicts.", ["plane", "notion", "gmail"]),
  a("dl_lead", "delivery", true, "ACCOUNT MGMT LEAD", "Head of Account Management", "Leads the account management team and owns the client portfolio — takes the warm transfer from Sales after each deal closes and drives retention, health, and growth.", ["notion", "gmail"]),
  a("dl_coord", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "Receives the warm transfer from Sales and onboards the new client, then owns the relationship day to day.", ["notion", "gmail"]),
  a("dl_qa", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "Manages a book of client accounts — health, check-ins, and issues — so every client is looked after.", ["notion", "gmail"]),
  a("dl_reports", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "Works alongside clients to drive adoption and outcomes so each account sees real results.", ["notion", "gmail"]),
  a("dl_assets", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "Owns renewals for a set of accounts and gets ahead of churn risk.", ["notion", "gmail"]),
  a("dl_design", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "Grows accounts — finds expansion and upsell opportunities across the client portfolio.", ["notion", "gmail"]),
  a("dl_onboard", "delivery", false, "ACCOUNT MANAGER", "Account Manager", "The relationship owner for key accounts — the human touch across the client portfolio.", ["gmail", "notion"]),
  a("sl_lead", "sales", true, "SALES LEAD", "Sales Lead", "Runs sales for Orbit Prism — owns the pipeline in the CRM, closes leads, and warm-transfers each new client to Account Management.", ["crm", "gmail"]),
  a("sl_enrich", "sales", false, "LEAD ENRICHER", "Enrichment Agent", "Enriches every lead in the CRM — role, company size, contact, profile — before it hits the pipeline.", ["crm", "clearbit"]),
  a("sl_inbound", "sales", false, "INBOUND MANAGER", "Inbound Leads Manager", "Qualifies every inbound within the hour, logs it in the CRM, and books the call.", ["crm", "gmail"]),
  a("sl_prospect", "sales", false, "PROSPECTOR", "Outbound Agent", "Builds fresh outbound lists to spec and loads verified prospects into the CRM.", ["crm", "apollo"]),
  a("sl_proposals", "sales", false, "PROPOSALS", "Proposal Agent", "Turns a CRM deal into a proposal and a send-ready email in minutes.", ["crm", "gmail"]),
  a("sl_followup", "sales", false, "FOLLOW UPS", "Revival Agent", "Works the CRM for stalled deals — post-demo silence, quiet pipelines — and revives them.", ["crm", "gmail"]),
  a("op_lead", "ops", true, "ENGINEERING LEAD", "AI Engineering Lead", "Runs engineering — plans and ships agents, client OS Command Centers, and IoT device specs; can take on any AI engineering task.", ["github", "plane", "notion"]),
  a("op_intel", "ops", false, "AGENT BUILDER", "Agent Engineering Agent", "Designs and builds new AI agents end to end — prompts, tools, memory, and orchestration.", ["github", "plane", "notion"]),
  a("op_legal", "ops", false, "COMMAND CENTER ENG", "OS Command Center Engineer", "Builds client OS Command Centers that integrate a fleet of agents into one system.", ["github", "plane", "notion"]),
  a("op_comply", "ops", false, "IOT ENGINEER", "IoT Solutions Engineer", "Designs and specs IoT devices and wires them into their agent integrations.", ["github", "plane", "notion"]),
  a("op_dash", "ops", false, "AI INTEGRATIONS", "AI Integrations Engineer", "Wires up models, APIs and data pipelines; handles evals, testing, and deployment.", ["github", "plane", "notion"]),
  a("fn_lead", "finance", true, "COMPTROLLER", "Comptroller — Head of Finance", "Head of Finance for Orbit Prism — owns all the finances in the books, leads the finance team, and gives the Chief of Staff regular updates on financial operations.", ["bigcapital", "gmail"]),
  a("fn_invoice", "finance", false, "INVOICING", "Finance Agent", "Raises every invoice in the books and chases every overdue — politely and relentlessly.", ["bigcapital", "stripe"]),
  a("fn_payable", "finance", false, "PAYABLES", "Finance Agent", "Records and audits every bill and contractor charge against what we agreed to pay.", ["bigcapital"]),
  a("fn_recon", "finance", false, "RECONCILIATION", "Finance Agent", "Matches every bank line to an invoice or bill in the books. Unmatched gets investigated.", ["bigcapital", "stripe"]),
];

function a(
  id: string,
  dept: DeptId,
  lead: boolean,
  name: string,
  role: string,
  does: string,
  tools: string[],
): Agent {
  return { id, dept, lead, name, role, does, tools, seat: 0 };
}

for (const dept of DEPARTMENTS) {
  let seat = 0;
  for (const ag of AGENTS) {
    if (ag.dept === dept.id) ag.seat = seat++;
  }
}

export const AGENTS_BY_DEPT: Record<DeptId, Agent[]> = Object.fromEntries(
  DEPARTMENTS.map((d) => [d.id, AGENTS.filter((x) => x.dept === d.id)]),
) as Record<DeptId, Agent[]>;

export function agentById(id: string): Agent | undefined {
  return AGENTS.find((x) => x.id === id);
}

export const LEADS: Agent[] = AGENTS.filter((a) => a.lead);

export function leadForDept(dept: DeptId): Agent | undefined {
  return AGENTS.find((a) => a.dept === dept && a.lead);
}

export const DEMO_CONNECTORS: Connector[] = [
  c("Gmail", "gmail", "connected", ["emails", "sales", "delivery", "marketing", "finance"]),
  c("Notion", "notion", "connected", ["marketing", "ops", "delivery", "sales", "emails"]),
  c("CRM", "crm", "connected", ["sales"], "Twenty CRM — using local mock data"),
  c("Bigcapital", "bigcapital", "connected", ["finance"], "Bigcapital — using local mock books"),
  c("Plane", "plane", "connected", ["ops", "emails"], "Plane — using local mock projects"),
  c("TryPost", "trypost", "connected", ["marketing"], "TryPost — using local mock posts"),
  c("Mautic", "mautic", "connected", ["marketing"], "Mautic — using local mock emails"),
  c("GitHub", "github", "connected", ["ops"]),
  c("Slack", "slack", "connected", ["emails", "ops"]),
  c("Canva", "canva", "connected", ["marketing", "delivery"]),
  c("Meta Ads", "meta", "connected", ["marketing"]),
  c("Stripe", "stripe", "connected", ["finance"]),
  c("Xero", "xero", "connected", ["finance"]),
  c("Apollo", "apollo", "connected", ["sales"]),
  c("Web Search", "websearch", "connected", ["marketing", "ops"]),
  c("Beehiiv", "beehiiv", "needs_auth", ["marketing"], "Sign in required"),
];

function c(
  name: string,
  key: string,
  status: Connector["status"],
  depts: DeptId[],
  reason?: string,
): Connector {
  return { name, key, status, depts, reason };
}
