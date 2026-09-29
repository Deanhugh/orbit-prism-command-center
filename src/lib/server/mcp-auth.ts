import { getSecret, setSecret } from "./providers";

export function mcpKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "") || "mcp";
}

function prefix(key: string): string {
  return `MCP_${key.toUpperCase()}`;
}

export function mcpAccessToken(key: string): string | undefined {
  const k = mcpKey(key);
  const p = prefix(k);
  return (
    getSecret(`${p}_TOKEN`) ||
    getSecret(`${p}_ACCESS_TOKEN`) ||
    (k === "notion" ? getSecret("NOTION_TOKEN") || getSecret("NOTION_API_KEY") : undefined)
  );
}

export function mcpRefreshToken(key: string): string | undefined {
  return getSecret(`${prefix(mcpKey(key))}_REFRESH_TOKEN`);
}

export function mcpExpiresAt(key: string): number {
  const raw = getSecret(`${prefix(mcpKey(key))}_EXPIRES_AT`);
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

export function mcpClientId(key: string): string | undefined {
  return getSecret(`${prefix(mcpKey(key))}_CLIENT_ID`);
}

export function mcpClientSecret(key: string): string | undefined {
  return getSecret(`${prefix(mcpKey(key))}_CLIENT_SECRET`);
}

export function setMcpTokens(
  key: string,
  patch: {
    token?: string | null;
    refresh?: string | null;
    expiresAt?: number | null;
    clientId?: string | null;
    clientSecret?: string | null;
  },
) {
  const p = prefix(mcpKey(key));
  if (patch.token !== undefined) setSecret(`${p}_TOKEN`, patch.token || "");
  if (patch.refresh !== undefined) setSecret(`${p}_REFRESH_TOKEN`, patch.refresh || "");
  if (patch.expiresAt !== undefined) {
    setSecret(`${p}_EXPIRES_AT`, patch.expiresAt ? String(patch.expiresAt) : "");
  }
  if (patch.clientId !== undefined) setSecret(`${p}_CLIENT_ID`, patch.clientId || "");
  if (patch.clientSecret !== undefined) setSecret(`${p}_CLIENT_SECRET`, patch.clientSecret || "");
}

export function clearMcpTokens(key: string) {
  setMcpTokens(key, {
    token: null,
    refresh: null,
    expiresAt: null,
  });
}

export function hasMcpToken(key: string): boolean {
  return Boolean(mcpAccessToken(key));
}

export function tokenLooksExpired(key: string, skewMs = 60_000): boolean {
  const exp = mcpExpiresAt(key);
  if (!exp) return false;
  return Date.now() + skewMs >= exp;
}
