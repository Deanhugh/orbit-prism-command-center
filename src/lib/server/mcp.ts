import type { Connector, DeptId } from "../types";
import { loadConfig, loadCustomConnectors, type CustomConnector } from "./config";
import { claudeMcpListRaw } from "./claude";
import { twentyConfigured } from "./twenty";
import { bigcapitalConfigured } from "./bigcapital";
import { planeConfigured } from "./plane";
import { trypostConfigured } from "./trypost";
import { catalogItemByName } from "../mcp-catalog";
import { mcpAccessToken, mcpKey } from "./mcp-auth";
import { clearRemoteProbeCache, isRemoteTransport, probeRemoteConnector } from "./mcp-remote";

const ALL_DEPTS: DeptId[] = [
  "marketing",
  "emails",
  "delivery",
  "sales",
  "ops",
  "finance",
];

const DEFAULT_WIRING: Record<string, DeptId[]> = {
  gmail: ALL_DEPTS,
  googledrive: ["delivery", "ops"],
  notion: ALL_DEPTS,
  slack: ["emails", "ops"],
  canva: ["marketing", "delivery"],
  meta: ["marketing"],
  stripe: ["finance"],
  xero: ["finance"],
  apollo: ["sales"],
  clearbit: ["sales"],
  beehiiv: ["marketing"],
  websearch: ALL_DEPTS,
  crm: ALL_DEPTS,
  bigcapital: ALL_DEPTS,
  plane: ALL_DEPTS,
  trypost: ALL_DEPTS,
  studio: ALL_DEPTS,
  github: ALL_DEPTS,
  apify: ALL_DEPTS,
  krea: ALL_DEPTS,
  higgsfield: ALL_DEPTS,
  cad: ALL_DEPTS,
};

export function normKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

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
      kind: "cli",
      status: connected ? "connected" : "needs_auth",
      reason: connected ? "Claude Code MCP" : "Authentication required",
      depts: DEFAULT_WIRING[key] ?? ALL_DEPTS,
    });
  }
  return out;
}

function platformConnectors(): Connector[] {
  const crmLive = twentyConfigured();
  const booksLive = bigcapitalConfigured();
  const pmLive = planeConfigured();
  const socialLive = trypostConfigured();
  return [
    {
      name: "CRM",
      key: "crm",
      kind: "platform",
      status: "connected",
      reason: crmLive ? "Twenty CRM — live instance connected" : "Twenty CRM — using local mock data",
      depts: ALL_DEPTS,
    },
    {
      name: "Bigcapital",
      key: "bigcapital",
      kind: "platform",
      status: "connected",
      reason: booksLive ? "Bigcapital — live instance connected" : "Bigcapital — using local mock books",
      depts: ALL_DEPTS,
    },
    {
      name: "Plane",
      key: "plane",
      kind: "platform",
      status: "connected",
      reason: pmLive ? "Plane — live instance connected" : "Plane — using local mock projects",
      depts: ALL_DEPTS,
    },
    {
      name: "TryPost",
      key: "trypost",
      kind: "platform",
      status: "connected",
      reason: socialLive ? "TryPost — live instance connected" : "TryPost — using local mock posts",
      depts: ALL_DEPTS,
    },
    {
      name: "Studio",
      key: "studio",
      kind: "native",
      status: "connected",
      reason: "Orbit Studio — text-to-cut on /studio",
      depts: ALL_DEPTS,
    },
    {
      name: "CAD Studio",
      key: "cad",
      kind: "native",
      status: "connected",
      reason: "Orbit CAD — text-to-part on /cad",
      depts: ALL_DEPTS,
    },
  ];
}

function applyPolicy(list: Connector[]): Connector[] {
  const cfg = loadConfig();
  const allow = cfg.mcp.allow.map(normKey);
  const deny = cfg.mcp.deny.map(normKey);
  const wiring = cfg.mcp.departments;
  return list.map((conn) => {
    let status = conn.status;
    if (deny.includes(conn.key)) status = "denied";
    else if (allow.length && !allow.includes(conn.key)) status = "denied";
    const override = wiring[conn.name] || wiring[conn.key];
    const reason = status === "denied" ? "Blocked in office.config.json" : conn.reason;
    return {
      ...conn,
      status,
      reason,
      depts: override ? (override as DeptId[]) : conn.depts,
    };
  });
}

async function remoteAsConnectors(): Promise<Connector[]> {
  const rows: Connector[] = [];
  for (const c of loadCustomConnectors()) {
    const key = mcpKey(c.name);
    const cat = catalogItemByName(c.name);
    const depts = (c.depts as DeptId[] | undefined)?.length ? (c.depts as DeptId[]) : DEFAULT_WIRING[key] ?? ALL_DEPTS;
    if (isRemoteTransport(c.transport) && /^https?:\/\//i.test(c.target)) {
      const probe = await probeRemoteConnector(c);
      const auth = c.auth || cat?.auth || (mcpAccessToken(key) ? "bearer" : "oauth");
      rows.push({
        name: c.name,
        key,
        kind: "remote",
        auth,
        hasToken: Boolean(mcpAccessToken(key)),
        url: c.target,
        tools: probe.tools.length || undefined,
        status: probe.ok ? "connected" : "needs_auth",
        reason: probe.ok
          ? `Live MCP · ${probe.reason}`
          : probe.reason,
        depts,
      });
      continue;
    }
    rows.push({
      name: c.name,
      key,
      kind: "cli",
      status: "needs_auth",
      reason: `Saved command — not live on Railway (${c.target})`,
      depts,
      url: c.target,
    });
  }
  return rows;
}

function mergeByKey(base: Connector[], extra: Connector[]): Connector[] {
  const have = new Set(base.map((c) => c.key));
  return [...base, ...extra.filter((c) => !have.has(c.key))];
}

/**
 * Live remote MCP + department platforms. Demo catalog apps (Gmail, etc.) are
 * not listed as connected unless Claude Code actually has them, or the owner
 * added a remote HTTP/SSE URL with a token / OAuth.
 */
export async function getConnectors(live = true): Promise<Connector[]> {
  void live;
  const platforms = platformConnectors();
  const remotes = await remoteAsConnectors();
  let claude: Connector[] = [];
  const raw = await claudeMcpListRaw();
  if (raw) {
    const parsed = parseMcpList(raw);
    if (parsed.length) claude = parsed;
  }
  return applyPolicy(mergeByKey(mergeByKey(platforms, remotes), claude));
}

export function connectorsForDept(
  connectors: Connector[],
  dept: DeptId,
): Connector[] {
  return connectors.filter(
    (c) => c.status === "connected" && c.depts.includes(dept),
  );
}

export function findCustom(name: string): CustomConnector | undefined {
  const key = normKey(name);
  return loadCustomConnectors().find((c) => normKey(c.name) === key);
}

export { clearRemoteProbeCache };
