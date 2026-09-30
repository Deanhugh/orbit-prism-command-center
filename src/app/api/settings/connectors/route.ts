import { NextRequest, NextResponse } from "next/server";
import { getConnectors, clearRemoteProbeCache } from "@/lib/server/mcp";
import { claudeStatus, claudeMcpAdd, claudeMcpRemove, type McpTransport } from "@/lib/server/claude";
import {
  addCustomConnector,
  loadConfig,
  loadCustomConnectors,
  removeCustomConnector,
  updateLocalConfig,
} from "@/lib/server/config";
import { MCP_CATALOG, catalogItemByName, parseMcpCommand } from "@/lib/mcp-catalog";
import { mcpAccessToken, mcpClientId, setMcpTokens, clearMcpTokens, mcpKey } from "@/lib/server/mcp-auth";
import { probeRemoteConnector, isRemoteTransport } from "@/lib/server/mcp-remote";
import { normalizeKreaUrl } from "@/lib/server/mcp-krea";
import { normalizeHiggsfieldUrl } from "@/lib/server/mcp-higgsfield";
import { normalizeSlackUrl, slackWorkspaceUrl } from "@/lib/server/mcp-slack";
import { refreshMode } from "@/lib/server/runtime";
import { listEnabledMcpApps } from "@/lib/server/mcp-nav-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

async function payload() {
  const status = await claudeStatus();
  const connectors = await getConnectors(true);
  const cfg = loadConfig();
  const deny = cfg.mcp.deny.map((n) => n.toLowerCase());
  const enabledKeys = new Set(
    connectors
      .filter((c) => c.status !== "denied" && !deny.includes(c.name.toLowerCase()))
      .map((c) => c.key),
  );
  const custom = loadCustomConnectors();
  return {
    live: connectors.some((c) => c.kind === "remote" && c.status === "connected") || status.available,
    reason: status.available
      ? status.reason
      : connectors.some((c) => c.kind === "remote" && c.status === "connected")
        ? "Remote MCP live on this host"
        : "Add a remote MCP (Notion, Apify, Krea, Higgsfield, or Slack) with OAuth or a token — npx commands are not live on Railway.",
    claude: status,
    connectors,
    deny: cfg.mcp.deny,
    custom: custom.map((c) => ({
      key: norm(c.name),
      name: c.name,
      transport: c.transport,
      target: c.target,
      auth: c.auth || (isRemoteTransport(c.transport) ? "oauth" : "none"),
      hasToken: Boolean(mcpAccessToken(c.name)),
      hasClient: Boolean(mcpClientId(c.name)),
    })),
    catalog: MCP_CATALOG.map((item) => ({
      ...item,
      enabled: enabledKeys.has(item.id) || enabledKeys.has(norm(item.name)) || enabledKeys.has(norm(item.id)),
    })),
    slackWorkspace: slackWorkspaceUrl(),
  };
}

export async function GET(req: NextRequest) {
  if (req.nextUrl.searchParams.get("nav") === "1") {
    return NextResponse.json({ apps: listEnabledMcpApps() });
  }
  return NextResponse.json(await payload());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  if (body.test) {
    let existing = loadCustomConnectors().find((c) => norm(c.name) === norm(name));
    const catalog = catalogItemByName(name);
    if (!existing && catalog?.remote) {
      addCustomConnector({
        name: catalog.name,
        transport: catalog.transport === "sse" ? "sse" : "http",
        target: catalog.command,
        addedAt: Date.now(),
        auth: catalog.auth || "oauth",
      });
      existing = loadCustomConnectors().find((c) => norm(c.name) === norm(name));
    }
    if (!existing || !isRemoteTransport(existing.transport)) {
      return NextResponse.json({ error: "Enable a remote MCP (HTTP/SSE) first." }, { status: 400 });
    }
    clearRemoteProbeCache();
    const probe = await probeRemoteConnector(existing, true);
    try { await refreshMode(); } catch { /* office may not have started */ }
    return NextResponse.json({ ok: probe.ok, test: probe, ...(await payload()) });
  }

  const catalog = catalogItemByName(name);
  const transport = String(body.transport || catalog?.transport || "stdio") as McpTransport;
  let target = String(body.target || catalog?.command || "").trim();
  let args = Array.isArray(body.args)
    ? body.args.map(String)
    : typeof body.args === "string" && body.args.trim()
      ? body.args.trim().split(/\s+/)
      : [];
  if (!["stdio", "sse", "http"].includes(transport)) {
    return NextResponse.json({ error: "invalid transport" }, { status: 400 });
  }
  if (transport === "stdio" && args.length === 0 && /\s/.test(target)) {
    const parsed = parseMcpCommand(target);
    target = parsed.target;
    args = parsed.args;
  }
  if (!target) return NextResponse.json({ error: "command/URL is required" }, { status: 400 });
  if (norm(name) === "krea" || norm(name) === "kreaai" || /krea\.ai/i.test(target)) {
    target = normalizeKreaUrl(target);
  }
  if (norm(name) === "higgsfield" || norm(name) === "higgsfeild" || /higgsfield\.ai/i.test(target)) {
    target = normalizeHiggsfieldUrl(target);
  }
  if (norm(name) === "slack" || /slack\.com/i.test(target)) {
    target = normalizeSlackUrl(target);
  }

  const auth = (body.auth as string) || catalog?.auth || (isRemoteTransport(transport) ? "oauth" : "none");
  const depts = Array.isArray(body.depts) ? body.depts.map(String) : undefined;

  const cfg = loadConfig();
  const deny = cfg.mcp.deny.filter((n) => n.toLowerCase() !== name.toLowerCase());
  if (deny.length !== cfg.mcp.deny.length) {
    updateLocalConfig({ mcp: { ...cfg.mcp, deny } });
  }

  if (typeof body.token === "string") {
    const token = body.token.trim();
    setMcpTokens(mcpKey(name), { token: token || null });
  }
  if (typeof body.clientId === "string" || typeof body.clientSecret === "string") {
    setMcpTokens(mcpKey(name), {
      clientId: typeof body.clientId === "string" ? body.clientId.trim() || null : undefined,
      clientSecret: typeof body.clientSecret === "string" ? body.clientSecret.trim() || null : undefined,
    });
  }

  if (transport === "stdio") {
    const result = await claudeMcpAdd(name, transport, target, args);
    addCustomConnector({ name, transport, target, args, depts, addedAt: Date.now(), auth: "none" });
    clearRemoteProbeCache();
    try { await refreshMode(); } catch { /* ignore */ }
    return NextResponse.json({ ok: true, ran: result.ran, message: result.message, ...(await payload()) });
  }

  addCustomConnector({
    name,
    transport,
    target,
    args,
    depts,
    addedAt: Date.now(),
    auth: auth === "bearer" || auth === "none" ? auth : "oauth",
  });
  clearRemoteProbeCache();
  const saved = loadCustomConnectors().find((c) => norm(c.name) === norm(name));
  const probe = saved ? await probeRemoteConnector(saved, true) : null;
  try { await refreshMode(); } catch { /* ignore */ }
  return NextResponse.json({
    ok: true,
    ran: false,
    message: probe?.ok
      ? `Live — ${probe.reason}`
      : `Saved ${name}. ${probe?.reason || "Connect with OAuth or paste a token, then Test."}`,
    test: probe,
    ...(await payload()),
  });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const result = await claudeMcpRemove(name);
  removeCustomConnector(name);
  clearMcpTokens(mcpKey(name));
  clearRemoteProbeCache();
  try { await refreshMode(); } catch { /* ignore */ }
  return NextResponse.json({ ok: true, ran: result.ran, message: result.message, ...(await payload()) });
}

export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "");
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const cfg = loadConfig();
  const set = new Set(cfg.mcp.deny);
  if (Boolean(body.deny)) set.add(name);
  else set.delete(name);
  updateLocalConfig({ mcp: { ...cfg.mcp, deny: [...set] } });
  try { await refreshMode(); } catch { /* ignore */ }
  return NextResponse.json(await payload());
}
