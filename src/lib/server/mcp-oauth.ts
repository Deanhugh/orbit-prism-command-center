import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import {
  mcpClientId,
  mcpClientSecret,
  mcpKey,
  mcpRefreshToken,
  setMcpTokens,
} from "./mcp-auth";
import { isSlackMcpUrl } from "./mcp-slack";

interface OAuthMeta {
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  scopes_supported?: string[];
  token_endpoint_auth_methods_supported?: string[];
}

interface PendingAuth {
  key: string;
  name: string;
  url: string;
  resource: string;
  verifier: string;
  tokenEndpoint: string;
  clientId: string;
  clientSecret?: string;
  tokenAuth: "basic" | "post" | "none";
  omitResource?: boolean;
  createdAt: number;
}

function stateFile(): string {
  return path.join(dataDir(), "mcp-oauth.json");
}

function readPending(): Record<string, PendingAuth> {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), "utf8")) as Record<string, PendingAuth>;
    const now = Date.now();
    const keep: Record<string, PendingAuth> = {};
    for (const [k, v] of Object.entries(raw || {})) {
      if (v && now - v.createdAt < 20 * 60_000) keep[k] = v;
    }
    return keep;
  } catch {
    return {};
  }
}

function writePending(map: Record<string, PendingAuth>) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(stateFile(), JSON.stringify(map, null, 2));
}

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function pkce(): { verifier: string; challenge: string } {
  const verifier = b64url(crypto.randomBytes(32));
  const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 10_000);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "follow",
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export function resourceOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

function canonicalMcpUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    u.search = "";
    const href = u.toString();
    return href.endsWith("/") && u.pathname !== "/" ? href.slice(0, -1) : href;
  } catch {
    return url;
  }
}

function stringList(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];
}

export async function discoverAuthServer(mcpUrl: string): Promise<{
  resource: string;
  meta: OAuthMeta;
  scopes: string[];
}> {
  const mcp = canonicalMcpUrl(mcpUrl);
  const origin = resourceOrigin(mcp);
  let pathname = "/";
  try {
    pathname = new URL(mcp).pathname.replace(/\/+$/, "") || "/";
  } catch {
    /* ignore */
  }
  const prmUrls = [
    pathname !== "/" ? `${origin}/.well-known/oauth-protected-resource${pathname}` : "",
    `${origin}/.well-known/oauth-protected-resource`,
    `${origin}/.well-known/oauth-protected-resource/mcp`,
  ].filter(Boolean);

  let protectedMd: Record<string, unknown> | null = null;
  for (const u of prmUrls) {
    protectedMd = await getJson(u);
    if (protectedMd) break;
  }

  const resource = canonicalMcpUrl(String(protectedMd?.resource || mcp));
  const servers = stringList(protectedMd?.authorization_servers);
  // Try the MCP origin first so Higgsfield (and similar) use the native
  // PKCE/DCR server at mcp.higgsfield.ai instead of Clerk or device-auth.
  const candidates = [origin, ...servers]
    .map((s) => s.replace(/\/+$/, ""))
    .filter((s, i, arr) => Boolean(s) && arr.indexOf(s) === i)
    .filter((s) => !isDeviceAuthIssuer(s));

  let picked: OAuthMeta | null = null;
  let fallback: OAuthMeta | null = null;
  for (const issuer of candidates) {
    const found = await loadAsMeta(issuer);
    if (!found?.authorization_endpoint || !found.token_endpoint) continue;
    if (!fallback) fallback = found;
    if (found.registration_endpoint) {
      picked = found;
      break;
    }
  }
  const meta = picked || fallback || {};
  const scopes =
    stringList(meta.scopes_supported).length
      ? stringList(meta.scopes_supported)
      : stringList(protectedMd?.scopes_supported).length
        ? stringList(protectedMd?.scopes_supported)
        : [];
  return { resource, meta: meta || {}, scopes };
}

function isDeviceAuthIssuer(issuer: string): boolean {
  try {
    const host = new URL(issuer).hostname.toLowerCase();
    return host.includes("device-auth") || host.startsWith("fnf-");
  } catch {
    return /device-auth/i.test(issuer);
  }
}

async function loadAsMeta(issuer: string): Promise<OAuthMeta | null> {
  const base = issuer.replace(/\/+$/, "");
  return (
    ((await getJson(`${base}/.well-known/oauth-authorization-server`)) as OAuthMeta | null) ||
    ((await getJson(`${base}/.well-known/openid-configuration`)) as OAuthMeta | null)
  );
}

async function registerClient(
  registrationEndpoint: string,
  redirectUri: string,
  clientName: string,
): Promise<{ client_id: string; client_secret?: string }> {
  const res = await fetch(registrationEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_name: clientName,
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      application_type: "web",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { client_id?: string; client_secret?: string; error?: string };
  if (!res.ok || !body.client_id) {
    throw new Error(body.error || `Could not register OAuth client (${res.status})`);
  }
  return { client_id: body.client_id, client_secret: body.client_secret };
}

export async function startMcpOAuth(opts: {
  name: string;
  url: string;
  redirectUri: string;
  clientName?: string;
}): Promise<{ authorizeUrl: string }> {
  const key = mcpKey(opts.name);
  const { resource, meta, scopes } = await discoverAuthServer(opts.url);
  const authorize = meta.authorization_endpoint;
  const tokenEndpoint = meta.token_endpoint;
  if (!authorize || !tokenEndpoint) {
    throw new Error("This MCP server did not advertise OAuth endpoints.");
  }
  let clientId = mcpClientId(key);
  let clientSecret = mcpClientSecret(key);
  if (!clientId && meta.registration_endpoint) {
    const reg = await registerClient(
      meta.registration_endpoint,
      opts.redirectUri,
      opts.clientName || "Orbit Prism Command Center",
    );
    clientId = reg.client_id;
    clientSecret = reg.client_secret;
    setMcpTokens(key, { clientId, clientSecret: clientSecret || null });
  }
  if (!clientId) {
    if (isSlackMcpUrl(opts.url)) {
      throw new Error(
        "Slack needs a Slack app Client ID and Secret. Paste them in Settings → MCP → Slack (or set SLACK_CLIENT_ID / SLACK_CLIENT_SECRET on Railway), then Connect with OAuth. Slack does not support automatic app registration.",
      );
    }
    throw new Error("OAuth client id missing — this server does not support dynamic registration.");
  }
  const { verifier, challenge } = pkce();
  const state = b64url(crypto.randomBytes(16));
  const methods = stringList(meta.token_endpoint_auth_methods_supported);
  const tokenAuth: PendingAuth["tokenAuth"] = methods.includes("client_secret_post")
    ? "post"
    : clientSecret
      ? "basic"
      : "none";
  const slack = isSlackMcpUrl(opts.url);
  const pending = readPending();
  pending[state] = {
    key,
    name: opts.name,
    url: opts.url,
    resource,
    verifier,
    tokenEndpoint,
    clientId,
    clientSecret,
    tokenAuth,
    omitResource: slack,
    createdAt: Date.now(),
  };
  writePending(pending);
  const u = new URL(authorize);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("redirect_uri", opts.redirectUri);
  u.searchParams.set("state", state);
  u.searchParams.set("code_challenge", challenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (scopes.length) u.searchParams.set("scope", scopes.join(" "));
  if (!slack) u.searchParams.set("resource", resource);
  return { authorizeUrl: u.toString() };
}

async function tokenRequest(
  tokenEndpoint: string,
  body: Record<string, string>,
  clientId: string,
  clientSecret?: string,
  tokenAuth: "basic" | "post" | "none" = "none",
): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string; ok?: boolean }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  const params = new URLSearchParams(body);
  if (tokenAuth === "post" && clientSecret) {
    params.set("client_id", clientId);
    params.set("client_secret", clientSecret);
  } else if (tokenAuth === "basic" && clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    params.set("client_id", clientId);
    if (clientSecret) params.set("client_secret", clientSecret);
  }
  const res = await fetch(tokenEndpoint, { method: "POST", headers, body: params });
  const raw = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    authed_user?: { access_token?: string };
  };
  const access = raw.access_token || raw.authed_user?.access_token;
  const error = raw.ok === false ? raw.error || "token exchange failed" : raw.error;
  return {
    access_token: access,
    refresh_token: raw.refresh_token,
    expires_in: raw.expires_in,
    error: access ? undefined : error,
    ok: raw.ok,
  };
}

export async function finishMcpOAuth(code: string, state: string, redirectUri: string): Promise<{ key: string; name: string }> {
  const pending = readPending();
  const row = pending[state];
  if (!row) throw new Error("OAuth state expired. Start Connect with OAuth again.");
  delete pending[state];
  writePending(pending);
  const tok = await tokenRequest(
    row.tokenEndpoint,
    {
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: row.verifier,
      ...(row.omitResource ? {} : { resource: row.resource }),
    },
    row.clientId,
    row.clientSecret,
    row.tokenAuth || "none",
  );
  if (!tok.access_token) {
    throw new Error(tok.error || "OAuth token exchange failed");
  }
  setMcpTokens(row.key, {
    token: tok.access_token,
    refresh: tok.refresh_token || null,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : null,
    clientId: row.clientId,
    clientSecret: row.clientSecret || null,
  });
  return { key: row.key, name: row.name };
}

export async function refreshMcpAccessToken(key: string, resource?: string): Promise<boolean> {
  const refresh = mcpRefreshToken(key);
  const clientId = mcpClientId(key);
  if (!refresh || !clientId) return false;
  const urlHint = resource || "";
  let tokenEndpoint = "";
  let tokenAuth: "basic" | "post" | "none" = mcpClientSecret(key) ? "basic" : "none";
  let omitResource = false;
  try {
    const discovered = await discoverAuthServer(urlHint || "https://mcp.notion.com/mcp");
    tokenEndpoint = discovered.meta.token_endpoint || "";
    resource = resource || discovered.resource;
    const methods = stringList(discovered.meta.token_endpoint_auth_methods_supported);
    if (methods.includes("client_secret_post")) tokenAuth = "post";
    omitResource = isSlackMcpUrl(urlHint || resource || "");
  } catch {
    return false;
  }
  if (!tokenEndpoint) return false;
  const tok = await tokenRequest(
    tokenEndpoint,
    {
      grant_type: "refresh_token",
      refresh_token: refresh,
      ...(omitResource || !resource ? {} : { resource }),
    },
    clientId,
    mcpClientSecret(key),
    tokenAuth,
  );
  if (!tok.access_token) return false;
  setMcpTokens(key, {
    token: tok.access_token,
    refresh: tok.refresh_token || refresh,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : null,
  });
  return true;
}
