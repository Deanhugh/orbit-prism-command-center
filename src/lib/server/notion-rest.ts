/** Notion REST fallback when hosted MCP wants OAuth but the owner pasted an integration token. */

const NOTION_VERSION = "2022-06-28";

export function looksLikeNotionToken(token: string): boolean {
  return /^(secret_|ntn_)/i.test(token.trim());
}

export function isNotionMcpUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "mcp.notion.com" || host.endsWith(".notion.com") || host === "api.notion.com";
  } catch {
    return /notion/i.test(url);
  }
}

async function notionFetch(token: string, path: string, init?: RequestInit): Promise<Response> {
  return fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export async function notionRestProbe(token: string): Promise<{ ok: boolean; reason: string }> {
  try {
    const res = await notionFetch(token, "/users/me");
    if (res.status === 401) return { ok: false, reason: "Notion token rejected" };
    if (!res.ok) return { ok: false, reason: `Notion API HTTP ${res.status}` };
    return { ok: true, reason: "Notion REST — live integration" };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Notion unreachable" };
  }
}

interface SearchHit {
  id: string;
  title: string;
  url?: string;
  kind: string;
}

function titleFromNotion(obj: Record<string, unknown>): string {
  const props = (obj.properties || {}) as Record<string, { title?: Array<{ plain_text?: string }>; name?: string }>;
  for (const v of Object.values(props)) {
    const t = v?.title?.map((x) => x.plain_text || "").join("") || "";
    if (t) return t;
  }
  const title = (obj as { title?: Array<{ plain_text?: string }> }).title;
  if (Array.isArray(title)) return title.map((x) => x.plain_text || "").join("");
  return String(obj.id || "Untitled");
}

export async function notionRestSearch(token: string, query: string, limit = 5): Promise<string> {
  const res = await notionFetch(token, "/search", {
    method: "POST",
    body: JSON.stringify({ query, page_size: limit }),
  });
  if (!res.ok) {
    const err = await res.text();
    return `Notion search failed (${res.status}): ${err.slice(0, 180)}`;
  }
  const data = (await res.json()) as { results?: Record<string, unknown>[] };
  const hits: SearchHit[] = (data.results || []).map((row) => ({
    id: String(row.id || ""),
    title: titleFromNotion(row),
    url: typeof row.url === "string" ? row.url : undefined,
    kind: String(row.object || "page"),
  }));
  if (!hits.length) return `No Notion pages matched “${query}”. Share pages with this integration if you expected hits.`;
  return hits
    .map((h) => `- ${h.title}${h.url ? ` (${h.url})` : ""} [${h.kind} ${h.id}]`)
    .join("\n");
}
