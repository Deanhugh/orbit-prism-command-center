import { loadCustomConnectors, type CustomConnector } from "./config";
import { mcpAccessToken, mcpKey } from "./mcp-auth";
import {
  argsForSearchTool,
  callMcpTool,
  openMcpSession,
  pickSearchTools,
  type McpProbe,
  type McpSession,
  type McpTool,
} from "./mcp-client";
import { isNotionMcpUrl, looksLikeNotionToken, notionRestProbe, notionRestSearch } from "./notion-rest";
import { isApifyConnector, looksLikeScrapeQuery, runApifyForQuery } from "./mcp-apify";

const probeCache = new Map<string, { at: number; value: McpProbe }>();

export function isRemoteTransport(t: string): t is "http" | "sse" {
  return t === "http" || t === "sse";
}

export function remoteConnectors(): CustomConnector[] {
  return loadCustomConnectors().filter((c) => isRemoteTransport(c.transport) && /^https?:\/\//i.test(c.target));
}

export async function probeRemoteConnector(conn: CustomConnector, force = false): Promise<McpProbe> {
  const key = mcpKey(conn.name);
  const cacheKey = `${key}:${conn.target}`;
  const hit = probeCache.get(cacheKey);
  if (!force && hit && Date.now() - hit.at < 20000) return hit.value;

  const token = mcpAccessToken(key);
  if (!token && conn.auth !== "none") {
    const value: McpProbe = {
      ok: false,
      reason: conn.auth === "oauth" ? "Connect with OAuth or paste a token" : "Paste a Bearer token",
      tools: [],
    };
    probeCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  const mcp = await openMcpSession({ key, url: conn.target, token });
  if (mcp.ok) {
    probeCache.set(cacheKey, { at: Date.now(), value: mcp });
    return mcp;
  }

  if (token && isNotionMcpUrl(conn.target) && looksLikeNotionToken(token)) {
    const rest = await notionRestProbe(token);
    const value: McpProbe = rest.ok
      ? {
          ok: true,
          reason: rest.reason,
          tools: [
            { name: "notion-search", description: "Search the Notion workspace" },
            { name: "notion-fetch", description: "Read a Notion page" },
          ],
        }
      : { ok: false, reason: rest.reason, tools: [] };
    probeCache.set(cacheKey, { at: Date.now(), value });
    return value;
  }

  probeCache.set(cacheKey, { at: Date.now(), value: mcp });
  return mcp;
}

export function clearRemoteProbeCache() {
  probeCache.clear();
}

export async function searchRemoteConnector(conn: CustomConnector, query: string): Promise<string | null> {
  const key = mcpKey(conn.name);
  const token = mcpAccessToken(key);
  const probe = await probeRemoteConnector(conn);
  if (!probe.ok) return null;

  if (isApifyConnector(conn) && probe.session) {
    try {
      return await runApifyForQuery(probe.session, query);
    } catch (err) {
      return err instanceof Error ? err.message : "Apify request failed";
    }
  }

  if (probe.session) {
    const tools = pickSearchTools(probe.session.tools.length ? probe.session.tools : probe.tools);
    const tool = tools[0];
    if (tool) {
      const called = await callMcpTool(probe.session, tool.name, argsForSearchTool(tool, query));
      if (called.ok && called.text.trim()) return called.text.slice(0, 4000);
    }
  }

  if (token && isNotionMcpUrl(conn.target) && looksLikeNotionToken(token)) {
    try {
      return await notionRestSearch(token, query);
    } catch (err) {
      return err instanceof Error ? err.message : "Notion search failed";
    }
  }
  return probe.reason;
}

export async function mcpContextForQuery(query: string): Promise<{ key: string; name: string; text: string }[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const out: { key: string; name: string; text: string }[] = [];
  for (const conn of remoteConnectors()) {
    if (isApifyConnector(conn) && !looksLikeScrapeQuery(q) && !/\bapify\b/i.test(q)) continue;
    const text = await searchRemoteConnector(conn, q);
    if (text) out.push({ key: mcpKey(conn.name), name: conn.name, text: text.slice(0, 2500) });
  }
  return out;
}

export function formatMcpContext(rows: { name: string; text: string }[]): string {
  if (!rows.length) return "";
  return rows.map((r) => `### ${r.name}\n${r.text}`).join("\n\n");
}

export type { McpProbe, McpSession, McpTool };
