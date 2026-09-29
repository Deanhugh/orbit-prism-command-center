import { NextRequest, NextResponse } from "next/server";
import { catalogItemByName } from "@/lib/mcp-catalog";
import { addCustomConnector, loadCustomConnectors } from "@/lib/server/config";
import { mcpKey } from "@/lib/server/mcp-auth";
import { startMcpOAuth } from "@/lib/server/mcp-oauth";
import { requestOrigin, redirectTo } from "@/lib/server/auth-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function callbackUrl(req: NextRequest): string {
  return new URL("/api/settings/connectors/oauth/callback", requestOrigin(req)).toString();
}

export async function GET(req: NextRequest) {
  const name = (req.nextUrl.searchParams.get("name") || "Notion").trim();
  const catalog = catalogItemByName(name);
  const existing = loadCustomConnectors().find(
    (c) => c.name.toLowerCase() === name.toLowerCase() || mcpKey(c.name) === mcpKey(name),
  );
  const transport = existing?.transport || catalog?.transport || "http";
  const target = existing?.target || catalog?.command || "";
  if (transport === "stdio" || !/^https?:\/\//i.test(target)) {
    return NextResponse.json(
      { error: "OAuth is for remote HTTP/SSE MCP URLs. Enable Notion from the catalog first." },
      { status: 400 },
    );
  }
  if (!existing) {
    addCustomConnector({
      name: catalog?.name || name,
      transport: transport === "sse" ? "sse" : "http",
      target,
      addedAt: Date.now(),
      auth: "oauth",
    });
  }
  try {
    const { authorizeUrl } = await startMcpOAuth({
      name: catalog?.name || name,
      url: target,
      redirectUri: callbackUrl(req),
    });
    return NextResponse.redirect(authorizeUrl, 302);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "OAuth start failed";
    return redirectTo(`/jarvis/settings?tab=mcp&mcp_error=${encodeURIComponent(msg)}`);
  }
}
