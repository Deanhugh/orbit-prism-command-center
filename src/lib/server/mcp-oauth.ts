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

interface OAuthMeta {
  authorization_endpoint?: string;
  token_endpoint?: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
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
  try {
    const res = await fetch(url, { headers: { Accept: "application/json" }, redirect: "follow" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function resourceOrigin(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

export async function discoverAuthServer(mcpUrl: string): Promise<{ resource: string; meta: OAuthMeta }> {
  const resource = resourceOrigin(mcpUrl);
  const protectedMd =
    (await getJson(`${resource}/.well-known/oauth-protected-resource`)) ||
    (await getJson(`${resource}/.well-known/oauth-protected-resource/mcp`));
  const servers = (protectedMd?.authorization_servers as string[] | undefined) || [resource];
  const issuer = String(servers[0] || resource).replace(/\/+$/, "");
  const meta =
    ((await getJson(`${issuer}/.well-known/oauth-authorization-server`)) as OAuthMeta | null) ||
    ((await getJson(`${issuer}/.well-known/openid-configuration`)) as OAuthMeta | null) ||
    {};
  return { resource, meta: meta || {} };
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
  const { resource, meta } = await discoverAuthServer(opts.url);
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
    throw new Error("OAuth client id missing — this server does not support dynamic registration.");
  }
  const { verifier, challenge } = pkce();
  const state = b64url(crypto.randomBytes(16));
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
  u.searchParams.set("scope", "default");
  u.searchParams.set("resource", resource);
  return { authorizeUrl: u.toString() };
}

async function tokenRequest(
  tokenEndpoint: string,
  body: Record<string, string>,
  clientId: string,
  clientSecret?: string,
): Promise<{ access_token?: string; refresh_token?: string; expires_in?: number; error?: string }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept: "application/json",
  };
  const params = new URLSearchParams(body);
  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  } else {
    params.set("client_id", clientId);
  }
  const res = await fetch(tokenEndpoint, { method: "POST", headers, body: params });
  return (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
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
      resource: row.resource,
    },
    row.clientId,
    row.clientSecret,
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
  try {
    const discovered = await discoverAuthServer(urlHint || "https://mcp.notion.com/mcp");
    tokenEndpoint = discovered.meta.token_endpoint || "";
    resource = resource || discovered.resource;
  } catch {
    return false;
  }
  if (!tokenEndpoint) return false;
  const tok = await tokenRequest(
    tokenEndpoint,
    {
      grant_type: "refresh_token",
      refresh_token: refresh,
      ...(resource ? { resource } : {}),
    },
    clientId,
    mcpClientSecret(key),
  );
  if (!tok.access_token) return false;
  setMcpTokens(key, {
    token: tok.access_token,
    refresh: tok.refresh_token || refresh,
    expiresAt: tok.expires_in ? Date.now() + tok.expires_in * 1000 : null,
  });
  return true;
}
