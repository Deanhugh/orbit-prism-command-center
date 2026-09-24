import { NextRequest, NextResponse } from "next/server";
import { getConnectors } from "@/lib/server/mcp";
import { claudeStatus, claudeMcpAdd, claudeMcpRemove, type McpTransport } from "@/lib/server/claude";
import { addCustomConnector, loadConfig, loadCustomConnectors, removeCustomConnector, updateLocalConfig } from "@/lib/server/config";
import { MCP_CATALOG, parseMcpCommand } from "@/lib/mcp-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export async function GET() {
  const status = await claudeStatus();
  const connectors = await getConnectors(status.available);
  const cfg = loadConfig();
  const deny = cfg.mcp.deny.map((n) => n.toLowerCase());
  const enabledKeys = new Set(
    connectors
      .filter((c) => c.status !== "denied" && !deny.includes(c.name.toLowerCase()))
      .map((c) => c.key),
  );
  return NextResponse.json({
    live: status.available,
    reason: status.reason,
    connectors,
    deny: cfg.mcp.deny,
    custom: loadCustomConnectors().map((c) => norm(c.name)),
    catalog: MCP_CATALOG.map((item) => ({
      ...item,
      enabled: enabledKeys.has(item.id) || enabledKeys.has(norm(item.name)) || enabledKeys.has(norm(item.id)),
    })),
  });
}

// Add an MCP / CLI connector (registers with Claude Code when the CLI is present,
// and saves it locally so it appears here regardless).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const transport = String(body.transport || "stdio") as McpTransport;
  let target = String(body.target || "").trim();
  if (!name || !target) {
    return NextResponse.json({ error: "name and command/URL are required" }, { status: 400 });
  }
  if (!["stdio", "sse", "http"].includes(transport)) {
    return NextResponse.json({ error: "invalid transport" }, { status: 400 });
  }
  let args = Array.isArray(body.args)
    ? body.args.map(String)
    : typeof body.args === "string" && body.args.trim()
      ? body.args.trim().split(/\s+/)
      : [];
  if (transport === "stdio" && args.length === 0 && /\s/.test(target)) {
    const parsed = parseMcpCommand(target);
    target = parsed.target;
    args = parsed.args;
  }
  const depts = Array.isArray(body.depts) ? body.depts.map(String) : undefined;

  const cfg = loadConfig();
  const deny = cfg.mcp.deny.filter((n) => n.toLowerCase() !== name.toLowerCase());
  if (deny.length !== cfg.mcp.deny.length) {
    updateLocalConfig({ mcp: { ...cfg.mcp, deny } });
  }

  const result = await claudeMcpAdd(name, transport, target, args);
  addCustomConnector({ name, transport, target, args, depts, addedAt: Date.now() });

  const status = await claudeStatus();
  const connectors = await getConnectors(status.available);
  return NextResponse.json({ ok: true, ran: result.ran, message: result.message, connectors });
}

// Remove a connector by name.
export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const result = await claudeMcpRemove(name);
  removeCustomConnector(name);
  const status = await claudeStatus();
  const connectors = await getConnectors(status.available);
  return NextResponse.json({ ok: true, ran: result.ran, message: result.message, connectors });
}

// toggle a connector's deny state (allow/deny), saved to office.config.local.json
export async function PUT(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "");
  const deny = Boolean(body.deny);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const cfg = loadConfig();
  const set = new Set(cfg.mcp.deny);
  if (deny) set.add(name);
  else set.delete(name);
  updateLocalConfig({ mcp: { ...cfg.mcp, deny: [...set] } });
  return NextResponse.json({ deny: [...set] });
}
