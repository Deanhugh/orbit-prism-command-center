import type { CustomConnector } from "./config";
import {
  argsForSearchTool,
  callMcpTool,
  parseJsonFromTool,
  type McpSession,
  type McpTool,
} from "./mcp-client";

/** Docs page the owner shared. The live Streamable HTTP endpoint is api.krea.ai/mcp. */
export const KREA_MCP_PAGE = "https://www.krea.ai/mcp";
export const KREA_MCP_URL = "https://api.krea.ai/mcp";

const IMAGE_MODEL = "image/krea/krea-2/medium";
const VIDEO_MODEL = "video/google/veo-3.1";
const POLL_ROUNDS = 8;
const POLL_GAP_MS = 4000;
const WALL_MS = 3 * 60_000;

export function normalizeKreaUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (host === "krea.ai" || host === "api.krea.ai") return KREA_MCP_URL;
  } catch {
    /* fall through */
  }
  return /krea\.ai/i.test(raw) ? KREA_MCP_URL : raw;
}

export function isKreaConnector(conn: CustomConnector): boolean {
  const name = conn.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name === "krea" || name === "kreaai") return true;
  try {
    const host = new URL(conn.target).hostname.replace(/^www\./, "");
    return host === "krea.ai" || host === "api.krea.ai";
  } catch {
    return /krea\.ai/i.test(conn.target);
  }
}

export function looksLikeKreaQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\bkrea\b/.test(q)) return true;
  return /\b(text[- ]to[- ]image|text[- ]to[- ]video|generate (an |a )?(image|photo|video|clip|render)|make (me )?(an |a )?(image|video|clip)|create (an |a )?(image|video|clip)|upscale|enhance (this |the )?(image|photo)|storyboard|hero image|product shot|cinematic (shot|still|clip)|flux|veo|kling)\b/.test(
    q,
  );
}

function looksLikeGenerate(query: string): boolean {
  return /\b(generate|make|create|render|upscale|enhance|storyboard|hero image|product shot|text[- ]to[- ]|image of|video of|photo of|clip of)\b/i.test(
    query,
  );
}

function wantsVideo(query: string): boolean {
  return /\b(video|clip|reel|film|animate|motion|veo|kling|text[- ]to[- ]video)\b/i.test(query);
}

function toolNamed(tools: McpTool[], ...names: string[]): McpTool | undefined {
  const want = names.map((n) => n.toLowerCase());
  return tools.find((t) => want.includes(t.name.toLowerCase()));
}

function asId(value: unknown): string | undefined {
  if (typeof value === "string" && value) return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id) return id;
  }
  return undefined;
}

function jobMeta(text: string, result?: unknown): { jobId?: string; status?: string; urls?: string[] } {
  const obj = parseJsonFromTool(text, result) || {};
  const nested =
    (obj.data as Record<string, unknown> | undefined) ||
    (obj.job as Record<string, unknown> | undefined) ||
    obj;
  const urlsRaw = nested.urls ?? obj.urls;
  const urls = Array.isArray(urlsRaw) ? urlsRaw.filter((u): u is string => typeof u === "string") : [];
  const output = nested.output as { urls?: unknown } | undefined;
  if (Array.isArray(output?.urls)) {
    for (const u of output.urls) if (typeof u === "string") urls.push(u);
  }
  return {
    jobId: asId(nested.job_id) || asId(nested.jobId) || asId(obj.job_id) || asId(obj.jobId) || asId(nested.id),
    status: typeof nested.status === "string" ? nested.status : typeof obj.status === "string" ? obj.status : undefined,
    urls,
  };
}

function generateArgs(tool: McpTool, query: string, video: boolean): Record<string, unknown> {
  const model = video ? VIDEO_MODEL : IMAGE_MODEL;
  const input: Record<string, unknown> = {
    prompt: query.trim(),
    aspect_ratio: video ? "16:9" : "16:9",
    resolution: "1K",
  };
  const props = tool.inputSchema?.properties || {};
  const args: Record<string, unknown> = {};
  if ("model" in props || !Object.keys(props).length) args.model = model;
  if ("input" in props || !Object.keys(props).length) args.input = input;
  if ("prompt" in props) args.prompt = query.trim();
  if ("aspect_ratio" in props) args.aspect_ratio = input.aspect_ratio;
  if (!Object.keys(args).length) {
    args.model = model;
    args.input = input;
  }
  return args;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDone(meta: { jobId?: string; status?: string; urls?: string[] }, fallback: string): string {
  const lines = [
    `Krea ${meta.status || "job"}${meta.jobId ? ` · ${meta.jobId}` : ""}.`,
    ...(meta.urls || []).slice(0, 4),
  ];
  const body = lines.filter(Boolean).join("\n");
  return body.trim() ? body : fallback.slice(0, 3500);
}

async function pollJob(session: McpSession, tools: McpTool[], started: { text: string; result?: unknown }): Promise<string> {
  let meta = jobMeta(started.text, started.result);
  const getJob = toolNamed(tools, "get_job", "get-job");
  const terminal = /^(completed|succeeded|failed|canceled|cancelled|error)$/i;
  const t0 = Date.now();

  if (meta.jobId && getJob && !terminal.test(meta.status || "")) {
    for (let i = 0; i < POLL_ROUNDS; i++) {
      if (Date.now() - t0 > WALL_MS) break;
      const polled = await callMcpTool(session, getJob.name, { jobId: meta.jobId }, { timeoutMs: 20_000 });
      if (!polled.ok) break;
      meta = { ...meta, ...jobMeta(polled.text, polled.result) };
      if (terminal.test(meta.status || "") || (meta.urls && meta.urls.length)) break;
      await sleep(POLL_GAP_MS);
    }
  }

  if (/^(failed|canceled|cancelled|error)$/i.test(meta.status || "") && !(meta.urls || []).length) {
    return `Krea job ${meta.status}${meta.jobId ? ` (${meta.jobId})` : ""}. ${started.text.slice(0, 800)}`;
  }
  return formatDone(meta, started.text);
}

export async function runKreaForQuery(session: McpSession, query: string): Promise<string | null> {
  const tools = session.tools;
  if (!tools.length) return null;

  if (!looksLikeGenerate(query)) {
    const list = toolNamed(tools, "list_models", "list-models");
    if (!list) return null;
    const found = await callMcpTool(session, list.name, argsForSearchTool(list, query), { timeoutMs: 20_000 });
    return found.ok ? found.text.slice(0, 2500) : found.text;
  }

  const generate = toolNamed(tools, "generate");
  if (!generate) return "Krea is connected but the generate tool is not loaded.";

  const started = await callMcpTool(session, generate.name, generateArgs(generate, query, wantsVideo(query)), {
    timeoutMs: 25_000,
  });
  if (!started.ok) return `Krea generate failed: ${started.text}`;
  return pollJob(session, tools, started);
}
