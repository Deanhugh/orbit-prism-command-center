import type { CustomConnector } from "./config";
import { argsForSearchTool, callMcpTool, pickSearchTools, type McpSession, type McpTool } from "./mcp-client";

/** Official hosted Streamable HTTP MCP. OAuth uses a Slack app (no DCR). */
export const SLACK_MCP_URL = "https://mcp.slack.com/mcp";
export const SLACK_WORKSPACE_HOST = "orbit-prism.slack.com";
export const SLACK_WORKSPACE_URL = "https://orbit-prism.slack.com";

export function slackWorkspaceUrl(): string {
  const fromEnv = (process.env.SLACK_WORKSPACE_URL || "").trim();
  if (fromEnv) {
    const raw = fromEnv.replace(/\/+$/, "");
    return raw.startsWith("http") ? raw : `https://${raw}`;
  }
  const domain = (process.env.SLACK_TEAM_DOMAIN || "").trim().replace(/\.slack\.com$/i, "");
  if (domain) return `https://${domain}.slack.com`;
  return SLACK_WORKSPACE_URL;
}

export function normalizeSlackUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (host === "slack.com" || host === "mcp.slack.com" || host === SLACK_WORKSPACE_HOST) return SLACK_MCP_URL;
  } catch {
    /* fall through */
  }
  if (/slack\.com/i.test(raw) || /orbit-prism\.slack\.com/i.test(raw)) return SLACK_MCP_URL;
  return raw;
}

export function isSlackMcpUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host === "mcp.slack.com" || host === "slack.com" || host === SLACK_WORKSPACE_HOST;
  } catch {
    return /mcp\.slack\.com|orbit-prism\.slack\.com/i.test(url);
  }
}

export function isSlackConnector(conn: CustomConnector): boolean {
  const name = conn.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name === "slack") return true;
  return isSlackMcpUrl(conn.target);
}

export function looksLikeSlackToken(token: string): boolean {
  return /^(xoxp-|xoxb-|xoxe-|xoxc-)/i.test(token.trim());
}

export function looksLikeSlackQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\bslack\b/.test(q) || /orbit-prism\.slack\.com/.test(q)) return true;
  return /\b(post (this |it )?to (slack|#)|send (a |the )?slack|slack (channel|dm|message|thread)|message the (team|channel)|dm (the )?(team|channel))\b/.test(
    q,
  );
}

function toolMatching(tools: McpTool[], ...needles: string[]): McpTool | undefined {
  const want = needles.map((n) => n.toLowerCase());
  return tools.find((t) => {
    const name = t.name.toLowerCase();
    return want.some((n) => name === n || name.includes(n));
  });
}

function wantsSend(query: string): boolean {
  return /\b(send|post|write|reply|dm|message|schedule)\b/i.test(query);
}

export async function runSlackForQuery(session: McpSession, query: string): Promise<string | null> {
  const tools = session.tools;
  if (!tools.length) return null;

  if (wantsSend(query)) {
    const send =
      toolMatching(tools, "slack_send_message", "send_message", "chat_post", "post_message") ||
      toolMatching(tools, "send-message", "post-message");
    if (send) {
      const args = argsForSearchTool(send, query);
      if (!("text" in args) && !("message" in args)) args.text = query;
      const sent = await callMcpTool(session, send.name, args, { timeoutMs: 25_000 });
      return sent.ok ? sent.text.slice(0, 3500) : `Slack send failed: ${sent.text}`;
    }
  }

  const search =
    toolMatching(tools, "slack_search_public_and_private", "slack_search_public", "search_messages", "search") ||
    pickSearchTools(tools)[0];
  if (!search) return "Slack is connected but no search tool is loaded.";
  const found = await callMcpTool(session, search.name, argsForSearchTool(search, query), { timeoutMs: 25_000 });
  return found.ok ? found.text.slice(0, 3500) : found.text;
}
