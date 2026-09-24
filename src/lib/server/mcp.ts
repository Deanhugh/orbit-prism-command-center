import type { Connector, DeptId } from "../types";
import { DEMO_CONNECTORS } from "../office-data";
import { loadConfig, loadCustomConnectors } from "./config";
import { claudeMcpListRaw } from "./claude";
import { twentyConfigured } from "./twenty";
import { bigcapitalConfigured } from "./bigcapital";
import { planeConfigured } from "./plane";
import { trypostConfigured } from "./trypost";
import { mauticConfigured } from "./mautic";

// Default department wiring for known brands (anything unknown feeds every pod).
const DEFAULT_WIRING: Record<string, DeptId[]> = {
  gmail: ["emails", "sales", "delivery"],
  googledrive: ["delivery", "ops"],
  notion: ["marketing", "ops", "delivery", "sales"],
  slack: ["emails", "ops"],
  canva: ["marketing", "delivery"],
  meta: ["marketing"],
  stripe: ["finance"],
  xero: ["finance"],
  apollo: ["sales"],
  clearbit: ["sales"],
  beehiiv: ["marketing"],
  websearch: ["marketing", "ops"],
  crm: ["sales"],
  bigcapital: ["finance"],
  plane: ["ops", "emails"],
  trypost: ["marketing"],
  mautic: ["marketing"],
  github: ["ops"],
};

const ALL_DEPTS: DeptId[] = [
  "marketing",
  "emails",
  "delivery",
  "sales",
  "ops",
  "finance",
];

function normKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Parse `claude mcp list` output. The CLI prints lines like:
 *   gmail: https://... - ✓ Connected
 *   stripe: npx ... - ✗ Failed to connect
 */
function parseMcpList(raw: string): Connector[] {
  const out: Connector[] = [];
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("Checking") || t.startsWith("No MCP")) continue;
    const m = t.match(/^([A-Za-z0-9_.\- ]+?):\s+(.*)$/);
    if (!m) continue;
    const name = m[1].trim();
    const rest = m[2];
    const connected = /✓|connected/i.test(rest) && !/fail|error|✗/i.test(rest);
    const key = normKey(name);
    out.push({
      name,
      key,
      status: connected ? "connected" : "needs_auth",
      reason: connected ? undefined : "Authentication required",
      depts: DEFAULT_WIRING[key] ?? ALL_DEPTS,
    });
  }
  return out;
}

function applyPolicy(list: Connector[]): Connector[] {
  const cfg = loadConfig();
  const allow = cfg.mcp.allow.map(normKey);
  const deny = cfg.mcp.deny.map(normKey);
  const wiring = cfg.mcp.departments;
  const crmLive = twentyConfigured();
  const booksLive = bigcapitalConfigured();
  const pmLive = planeConfigured();
  const socialLive = trypostConfigured();
  const emailLive = mauticConfigured();
  return list.map((conn) => {
    let status = conn.status;
    if (deny.includes(conn.key)) status = "denied";
    else if (allow.length && !allow.includes(conn.key)) status = "denied";
    const override = wiring[conn.name] || wiring[conn.key];
    let reason = status === "denied" ? "Blocked in office.config.json" : conn.reason;
    // Reflect whether the CRM is talking to a live Twenty instance or the mock.
    if (conn.key === "crm" && status !== "denied") {
      reason = crmLive ? "Twenty CRM — live instance connected" : "Twenty CRM — using local mock data";
    }
    // Same for the Finance books (Bigcapital).
    if (conn.key === "bigcapital" && status !== "denied") {
      reason = booksLive ? "Bigcapital — live instance connected" : "Bigcapital — using local mock books";
    }
    // Same for project management (Plane).
    if (conn.key === "plane" && status !== "denied") {
      reason = pmLive ? "Plane — live instance connected" : "Plane — using local mock projects";
    }
    // Same for marketing (TryPost).
    if (conn.key === "trypost" && status !== "denied") {
      reason = socialLive ? "TryPost — live instance connected" : "TryPost — using local mock posts";
    }
    // Same for email marketing (Mautic).
    if (conn.key === "mautic" && status !== "denied") {
      reason = emailLive ? "Mautic — live instance connected" : "Mautic — using local mock emails";
    }
    return {
      ...conn,
      status,
      reason,
      depts: override ? (override as DeptId[]) : conn.depts,
    };
  });
}

// Connectors the user added from Settings (persisted locally).
function customConnectors(): Connector[] {
  return loadCustomConnectors().map((c) => {
    const key = normKey(c.name);
    return {
      name: c.name,
      key,
      status: "connected" as const,
      reason: c.transport === "stdio" ? `CLI · ${c.target}` : `${c.transport.toUpperCase()} · ${c.target}`,
      depts: (c.depts as DeptId[] | undefined)?.length ? (c.depts as DeptId[]) : ALL_DEPTS,
    };
  });
}

// Merge custom connectors in, de-duped by key (base list wins on conflicts).
function mergeCustom(base: Connector[]): Connector[] {
  const have = new Set(base.map((c) => c.key));
  const extra = customConnectors().filter((c) => !have.has(c.key));
  return [...base, ...extra];
}

export async function getConnectors(live: boolean): Promise<Connector[]> {
  if (!live) return applyPolicy(mergeCustom(DEMO_CONNECTORS));
  const raw = await claudeMcpListRaw();
  const base = (() => {
    if (!raw) return DEMO_CONNECTORS;
    const parsed = parseMcpList(raw);
    return parsed.length ? parsed : DEMO_CONNECTORS;
  })();
  return applyPolicy(mergeCustom(base));
}

/** Connectors an agent may use, given the department wiring and allow/deny. */
export function connectorsForDept(
  connectors: Connector[],
  dept: DeptId,
): Connector[] {
  return connectors.filter(
    (c) => c.status === "connected" && c.depts.includes(dept),
  );
}
