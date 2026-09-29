import type { CustomConnector } from "./config";
import {
  argsForSearchTool,
  callMcpTool,
  parseJsonFromTool,
  type McpSession,
  type McpTool,
} from "./mcp-client";

/** Hosted Streamable HTTP MCP. Do not use /sse, stdio, or npx. Rental and full-permission Actors stay unpinned. */
export const APIFY_MCP_URL =
  "https://mcp.apify.com?tools=actors,apify/rag-web-browser,apify/web-fetch,apify/instagram-scraper,apify/google-search-scraper";

const CALL_OPTIONS = { maxItems: 10, maxTotalChargeUsd: 1 };
const START_TIMEOUT_MS = 25_000;
const POLL_WAIT_SECS = 30;
const POLL_HTTP_TIMEOUT_MS = 50_000;
const POLL_ROUNDS = 8;
const WALL_MS = 5 * 60_000;
const ITEMS_LIMIT = 12;

export function isApifyConnector(conn: CustomConnector): boolean {
  const name = conn.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name === "apify") return true;
  try {
    return new URL(conn.target).hostname.replace(/^www\./, "") === "mcp.apify.com";
  } catch {
    return /mcp\.apify\.com/i.test(conn.target);
  }
}

export function looksLikeScrapeQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/https?:\/\//i.test(query)) return true;
  return /\b(scrape|scraping|crawl|crawler|apify|web fetch|fetch the page|search the web|instagram|tiktok|facebook|linkedin|reddit|youtube|serp|google search|search google|social media|website data|extract from the web)\b/.test(
    q,
  );
}

function toolNamed(tools: McpTool[], ...names: string[]): McpTool | undefined {
  const want = names.map((n) => n.toLowerCase());
  return tools.find((t) => want.includes(t.name.toLowerCase()));
}

function firstUrl(query: string): string | undefined {
  const m = query.match(/https?:\/\/[^\s)>\]]+/i);
  return m ? m[0].replace(/[.,;]+$/, "") : undefined;
}

function searchTerm(query: string): string {
  const stripped = query
    .replace(/https?:\/\/[^\s)>\]]+/gi, " ")
    .replace(
      /\b(please|scrape|scraping|crawl|crawler|apify|fetch the page|web fetch|search the web|instagram|tiktok|facebook|linkedin|reddit|youtube|serp|google search|search google|social media|website data|extract from the web)\b/gi,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
  return stripped || query.trim();
}

function asId(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return undefined;
}

function runObject(text: string, result?: unknown): Record<string, unknown> {
  const obj = parseJsonFromTool(text, result) || {};
  const nested =
    (obj.data as Record<string, unknown> | undefined) ||
    (obj.run as Record<string, unknown> | undefined) ||
    obj;
  return nested && typeof nested === "object" ? nested : obj;
}

function runMeta(
  text: string,
  result?: unknown,
): {
  runId?: string;
  status?: string;
  datasetId?: string;
  itemCount?: number;
} {
  const obj = runObject(text, result);
  const storages = (obj.storages as Record<string, unknown> | undefined) || {};
  const datasets = storages.datasets as { default?: unknown } | undefined;
  const datasetId =
    asId(obj.datasetId) ||
    asId(obj.defaultDatasetId) ||
    asId(storages.default) ||
    asId(datasets?.default);
  return {
    runId: asId(obj.runId) || asId(obj.id),
    status: typeof obj.status === "string" ? obj.status : undefined,
    datasetId,
    itemCount: typeof obj.itemCount === "number" ? obj.itemCount : undefined,
  };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function dedicatedKind(name: string): "instagram" | "google" | "fetch" | "rag" | "call" | "other" {
  const n = name.toLowerCase();
  if (n.includes("instagram-scraper")) return "instagram";
  if (n.includes("google-search-scraper")) return "google";
  if (n.includes("web-fetch") || n.endsWith("web-fetch")) return "fetch";
  if (n.includes("rag-web-browser")) return "rag";
  if (n === "call-actor") return "call";
  return "other";
}

function instagramInput(query: string, url?: string): Record<string, unknown> {
  const input: Record<string, unknown> = { resultsType: "posts", resultsLimit: 10 };
  if (url) input.directUrls = [url];
  else input.search = searchTerm(query);
  return input;
}

function googleInput(query: string): Record<string, unknown> {
  return { queries: searchTerm(query), maxPagesPerQuery: 1 };
}

function fetchInput(url: string): Record<string, unknown> {
  return { url, formats: ["markdown"] };
}

function ragInput(query: string, url?: string): Record<string, unknown> {
  return { query: url || query, maxResults: 3 };
}

function actorForQuery(query: string, url?: string): string {
  if (/\binstagram\b/i.test(query) || /instagram\.com/i.test(url || "")) return "apify/instagram-scraper";
  if (/\b(google search|serp|search google)\b/i.test(query)) return "apify/google-search-scraper";
  if (url) return "apify/web-fetch";
  return "apify/rag-web-browser";
}

function inputForActor(actor: string, query: string, url?: string): Record<string, unknown> {
  if (actor === "apify/instagram-scraper") return instagramInput(query, url);
  if (actor === "apify/google-search-scraper") return googleInput(query);
  if (actor === "apify/web-fetch" && url) return fetchInput(url);
  return ragInput(query, url);
}

function toolArgs(tool: McpTool, query: string, url?: string): Record<string, unknown> {
  const kind = dedicatedKind(tool.name);
  const wait = { waitSecs: 0, callOptions: CALL_OPTIONS };
  if (kind === "instagram") return { ...wait, ...instagramInput(query, url) };
  if (kind === "google") return { ...wait, ...googleInput(query) };
  if (kind === "fetch" && url) return { ...wait, ...fetchInput(url) };
  if (kind === "rag") return { ...wait, ...ragInput(query, url) };
  if (kind === "call") {
    const actor = actorForQuery(query, url);
    return { actor, waitSecs: 0, input: inputForActor(actor, query, url), callOptions: CALL_OPTIONS };
  }
  const args = argsForSearchTool(tool, url || query);
  args.waitSecs = 0;
  args.callOptions = CALL_OPTIONS;
  return args;
}

async function pollAndFetch(
  session: McpSession,
  tools: McpTool[],
  started: { ok: boolean; text: string; result?: unknown },
): Promise<string> {
  let meta = runMeta(started.text, started.result);
  const getRun = toolNamed(tools, "get-actor-run");
  const getItems = toolNamed(tools, "get-dataset-items");
  const abort = toolNamed(tools, "abort-actor-run");
  const terminal = /^(SUCCEEDED|FAILED|TIMED-OUT|ABORTED|TIMED_OUT)$/i;
  const t0 = Date.now();

  if (meta.runId && getRun && !terminal.test(meta.status || "")) {
    for (let i = 0; i < POLL_ROUNDS; i++) {
      if (Date.now() - t0 > WALL_MS) break;
      const polled = await callMcpTool(
        session,
        getRun.name,
        { runId: meta.runId, waitSecs: POLL_WAIT_SECS },
        { timeoutMs: POLL_HTTP_TIMEOUT_MS },
      );
      if (!polled.ok) break;
      meta = { ...meta, ...runMeta(polled.text, polled.result) };
      if (terminal.test(meta.status || "")) break;
      await sleep(400);
    }
  }

  if (meta.runId && abort && !terminal.test(meta.status || "") && Date.now() - t0 > WALL_MS) {
    await callMcpTool(session, abort.name, { runId: meta.runId }, { timeoutMs: 20_000 });
    meta = { ...meta, status: meta.status || "ABORTED" };
  }

  if (/^(FAILED|TIMED-OUT|ABORTED|TIMED_OUT)$/i.test(meta.status || "") && !meta.datasetId) {
    return `Apify run ${meta.status}${meta.runId ? ` (${meta.runId})` : ""}. ${started.text.slice(0, 800)}`;
  }

  if (meta.datasetId && getItems) {
    const items = await callMcpTool(
      session,
      getItems.name,
      { datasetId: meta.datasetId, limit: ITEMS_LIMIT, clean: true },
      { timeoutMs: 20_000 },
    );
    if (items.ok && items.text.trim()) {
      return [`Apify run ${meta.status || "done"}${meta.runId ? ` · ${meta.runId}` : ""}.`, items.text.slice(0, 3500)].join(
        "\n",
      );
    }
  }

  return started.text.slice(0, 3500);
}

function pickScrapeTool(tools: McpTool[], query: string): McpTool | undefined {
  const q = query.toLowerCase();
  const url = firstUrl(query) || "";
  if (/\binstagram\b/i.test(q) || /instagram\.com/i.test(url)) {
    return toolNamed(tools, "apify--instagram-scraper", "apify-instagram-scraper");
  }
  if (/\b(google search|serp|search google)\b/i.test(q)) {
    return toolNamed(tools, "apify--google-search-scraper", "apify-google-search-scraper");
  }
  if (url && toolNamed(tools, "apify--web-fetch", "apify-web-fetch")) {
    return toolNamed(tools, "apify--web-fetch", "apify-web-fetch");
  }
  return (
    toolNamed(tools, "apify--rag-web-browser", "apify-rag-web-browser") ||
    toolNamed(tools, "apify--web-fetch", "apify-web-fetch") ||
    toolNamed(tools, "call-actor")
  );
}

export async function runApifyForQuery(session: McpSession, query: string): Promise<string | null> {
  const tools = session.tools;
  if (!tools.length) return null;

  if (!looksLikeScrapeQuery(query)) {
    const search = toolNamed(tools, "search-actors");
    if (!search) return null;
    const found = await callMcpTool(session, search.name, argsForSearchTool(search, query), { timeoutMs: 20_000 });
    return found.ok ? found.text.slice(0, 2500) : found.text;
  }

  const url = firstUrl(query);
  const tool = pickScrapeTool(tools, query);
  if (!tool) return "Apify is connected but no scrape tool is loaded.";

  const args = toolArgs(tool, query, url);
  const started = await callMcpTool(session, tool.name, args, { timeoutMs: START_TIMEOUT_MS });
  if (!started.ok) return `Apify ${tool.name} failed: ${started.text}`;
  return pollAndFetch(session, tools, started);
}
