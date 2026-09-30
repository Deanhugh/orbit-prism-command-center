export const MCP_NAV_EVENT = "orbit-mcp-nav";

export function notifyMcpNav() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(MCP_NAV_EVENT));
}

export interface McpNavApp {
  key: string;
  name: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Enabled MCP apps for the Command Center System list (icon + name). */
export function mcpNavApps(data: {
  catalog?: { id: string; name: string; enabled?: boolean }[];
  custom?: { key: string; name: string }[] | string[];
  deny?: string[];
}): McpNavApp[] {
  const deny = new Set((data.deny || []).map(norm));
  const seen = new Set<string>();
  const out: McpNavApp[] = [];

  function add(key: string, name: string) {
    const k = norm(key) || norm(name);
    if (!k || deny.has(k) || seen.has(k)) return;
    seen.add(k);
    out.push({ key: k, name: name.trim() || k });
  }

  for (const item of data.catalog || []) {
    if (item.enabled) add(item.id, item.name);
  }
  for (const row of data.custom || []) {
    if (typeof row === "string") add(row, row);
    else add(row.key || row.name, row.name || row.key);
  }
  return out;
}
