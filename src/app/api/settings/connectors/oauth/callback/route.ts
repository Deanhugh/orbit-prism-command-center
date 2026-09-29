import { NextRequest } from "next/server";
import { finishMcpOAuth } from "@/lib/server/mcp-oauth";
import { clearRemoteProbeCache } from "@/lib/server/mcp";
import { requestOrigin, redirectTo } from "@/lib/server/auth-http";
import { refreshMode } from "@/lib/server/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const err = req.nextUrl.searchParams.get("error");
  if (err) {
    const detail = req.nextUrl.searchParams.get("error_description") || err;
    return redirectTo(`/jarvis/settings?tab=mcp&mcp_error=${encodeURIComponent(detail)}`);
  }
  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  if (!code || !state) {
    return redirectTo("/jarvis/settings?tab=mcp&mcp_error=missing_code");
  }
  const redirectUri = new URL("/api/settings/connectors/oauth/callback", requestOrigin(req)).toString();
  try {
    const done = await finishMcpOAuth(code, state, redirectUri);
    clearRemoteProbeCache();
    try { await refreshMode(); } catch { /* ignore */ }
    return redirectTo(`/jarvis/settings?tab=mcp&mcp_ok=${encodeURIComponent(done.name)}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "oauth_failed";
    return redirectTo(`/jarvis/settings?tab=mcp&mcp_error=${encodeURIComponent(msg)}`);
  }
}
