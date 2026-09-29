import { mcpAccessToken, mcpRefreshToken, setMcpTokens, tokenLooksExpired } from "./mcp-auth";
import { refreshMcpAccessToken } from "./mcp-oauth";

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
}

export interface McpSession {
  url: string;
  token?: string;
  sessionId?: string;
  protocolVersion?: string;
  tools: McpTool[];
}

export interface McpProbe {
  ok: boolean;
  reason: string;
  tools: McpTool[];
  session?: McpSession;
}

type RpcResult = {
  ok: boolean;
  status: number;
  result?: unknown;
  error?: string;
  sessionId?: string;
  wwwAuthenticate?: string | null;
};

const PROTOCOL = "2025-03-26";
const TIMEOUT_MS = 14000;

function parseSsePayload(text: string): unknown {
  const blocks = text.split(/\r?\n\r?\n/);
  for (const block of blocks) {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    if (!data || data === "[DONE]") continue;
    try {
      return JSON.parse(data);
    } catch {
      /* next block */
    }
  }
  return null;
}

async function rpc(
  url: string,
  body: Record<string, unknown>,
  token?: string,
  sessionId?: string,
  timeoutMs = TIMEOUT_MS,
): Promise<RpcResult> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "MCP-Protocol-Version": PROTOCOL,
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionId) headers["Mcp-Session-Id"] = sessionId;

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ac.signal,
      redirect: "follow",
    });
    const nextSession = res.headers.get("mcp-session-id") || sessionId;
    const www = res.headers.get("www-authenticate");
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    const raw = await res.text();
    let parsed: Record<string, unknown> | null = null;
    if (ct.includes("text/event-stream")) {
      parsed = parseSsePayload(raw) as Record<string, unknown> | null;
    } else if (raw.trim()) {
      try {
        parsed = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsed = null;
      }
    }
    if (!res.ok) {
      const err =
        (parsed?.error as { message?: string } | undefined)?.message ||
        raw.slice(0, 180) ||
        `HTTP ${res.status}`;
      return { ok: false, status: res.status, error: err, sessionId: nextSession, wwwAuthenticate: www };
    }
    if (parsed?.error) {
      const err = parsed.error as { message?: string };
      return { ok: false, status: res.status, error: err.message || "MCP error", sessionId: nextSession };
    }
    return { ok: true, status: res.status, result: parsed?.result ?? parsed, sessionId: nextSession };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "request failed";
    return { ok: false, status: 0, error: msg.includes("abort") ? "timeout" : msg };
  } finally {
    clearTimeout(t);
  }
}

async function tokenFor(key: string, resource?: string): Promise<string | undefined> {
  if (tokenLooksExpired(key) && mcpRefreshToken(key)) {
    await refreshMcpAccessToken(key, resource);
  }
  return mcpAccessToken(key);
}

export async function openMcpSession(opts: {
  key: string;
  url: string;
  token?: string;
}): Promise<McpProbe> {
  const url = opts.url.trim();
  if (!url) return { ok: false, reason: "No MCP URL", tools: [] };
  let token = opts.token ?? (await tokenFor(opts.key, originOf(url)));
  const init = await rpc(
    url,
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: PROTOCOL,
        capabilities: {},
        clientInfo: { name: "orbit-prism-command-center", version: "0.1.0" },
      },
    },
    token,
  );
  if (!init.ok && init.status === 401 && mcpRefreshToken(opts.key)) {
    await refreshMcpAccessToken(opts.key, originOf(url));
    token = mcpAccessToken(opts.key);
    const retry = await rpc(
      url,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: PROTOCOL,
          capabilities: {},
          clientInfo: { name: "orbit-prism-command-center", version: "0.1.0" },
        },
      },
      token,
    );
    if (retry.ok) Object.assign(init, retry);
  }
  if (!init.ok) {
    return {
      ok: false,
      reason: init.status === 401 ? "Authentication required" : init.error || "Could not initialize MCP",
      tools: [],
    };
  }
  await rpc(
    url,
    { jsonrpc: "2.0", method: "notifications/initialized", params: {} },
    token,
    init.sessionId,
  );
  const listed = await rpc(
    url,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    token,
    init.sessionId,
  );
  const tools = Array.isArray((listed.result as { tools?: McpTool[] } | undefined)?.tools)
    ? ((listed.result as { tools: McpTool[] }).tools)
    : [];
  const proto =
    typeof (init.result as { protocolVersion?: string } | undefined)?.protocolVersion === "string"
      ? (init.result as { protocolVersion: string }).protocolVersion
      : PROTOCOL;
  return {
    ok: true,
    reason: tools.length ? `${tools.length} tools` : "Connected",
    tools,
    session: { url, token, sessionId: init.sessionId, protocolVersion: proto, tools },
  };
}

export async function callMcpTool(
  session: McpSession,
  name: string,
  args: Record<string, unknown>,
  opts?: { timeoutMs?: number },
): Promise<{ ok: boolean; text: string; result?: unknown }> {
  const res = await rpc(
    session.url,
    {
      jsonrpc: "2.0",
      id: Date.now() % 1_000_000,
      method: "tools/call",
      params: { name, arguments: args },
    },
    session.token,
    session.sessionId,
    opts?.timeoutMs,
  );
  if (!res.ok) return { ok: false, text: res.error || "tool call failed" };
  return { ok: true, text: stringifyToolResult(res.result), result: res.result };
}

export function argsForSearchTool(tool: McpTool, query: string): Record<string, unknown> {
  const props = tool.inputSchema?.properties || {};
  const names = Object.keys(props);
  const preferred =
    names.find((n) => /^(query|q|search|text|prompt|question|input)$/i.test(n)) ||
    names.find((n) => (props[n]?.type || "string") === "string") ||
    "query";
  const args: Record<string, unknown> = { [preferred]: query };
  for (const req of tool.inputSchema?.required || []) {
    if (args[req] === undefined) {
      const t = props[req]?.type;
      args[req] = t === "number" ? 5 : t === "boolean" ? false : query;
    }
  }
  return args;
}

export function pickSearchTools(tools: McpTool[]): McpTool[] {
  const scored = tools.map((t) => {
    const hay = `${t.name} ${t.description || ""}`.toLowerCase();
    let n = 0;
    if (/\b(search|query|find|lookup|fetch|retrieve|list)\b/.test(hay)) n += 2;
    if (/\b(write|create|update|delete|insert|append)\b/.test(hay)) n -= 3;
    return { t, n };
  });
  return scored
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .map((x) => x.t);
}

export function parseJsonFromTool(text: string, result?: unknown): Record<string, unknown> | null {
  if (result && typeof result === "object") {
    const r = result as { structuredContent?: unknown; content?: Array<{ text?: string }> };
    if (r.structuredContent && typeof r.structuredContent === "object") {
      return r.structuredContent as Record<string, unknown>;
    }
    if (Array.isArray(r.content)) {
      for (const c of r.content) {
        if (c.text) {
          const inner = parseJsonFromTool(c.text);
          if (inner) return inner;
        }
      }
    }
  }
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const m = trimmed.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

export function stringifyToolResult(result: unknown): string {
  if (!result) return "";
  if (typeof result === "string") return result;
  const r = result as { content?: Array<{ type?: string; text?: string }>; structuredContent?: unknown };
  if (Array.isArray(r.content)) {
    const text = r.content.map((c) => c.text || "").filter(Boolean).join("\n");
    if (text) return text;
  }
  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return String(result);
  }
}

function originOf(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

export { setMcpTokens };
