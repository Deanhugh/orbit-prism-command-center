import type { CustomConnector } from "./config";
import {
  argsForSearchTool,
  callMcpTool,
  parseJsonFromTool,
  type McpSession,
  type McpTool,
} from "./mcp-client";

/** Hosted Streamable HTTP MCP. OAuth only — Higgsfield does not use an API key. */
export const HIGGSFIELD_MCP_URL = "https://mcp.higgsfield.ai/mcp";

const WALL_MS = 3 * 60_000;
const POLL_ROUNDS = 8;
const POLL_GAP_MS = 4000;

export function normalizeHiggsfieldUrl(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  try {
    const host = new URL(raw).hostname.replace(/^www\./, "");
    if (host === "higgsfield.ai" || host === "mcp.higgsfield.ai") return HIGGSFIELD_MCP_URL;
  } catch {
    /* fall through */
  }
  return /higgsfield\.ai/i.test(raw) ? HIGGSFIELD_MCP_URL : raw;
}

export function isHiggsfieldConnector(conn: CustomConnector): boolean {
  const name = conn.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (name === "higgsfield" || name === "higgsfeild") return true;
  try {
    const host = new URL(conn.target).hostname.replace(/^www\./, "");
    return host === "higgsfield.ai" || host === "mcp.higgsfield.ai";
  } catch {
    return /higgsfield\.ai/i.test(conn.target);
  }
}

export function looksLikeHiggsfieldQuery(query: string): boolean {
  const q = query.toLowerCase();
  if (/\b(higgsfield|higgsfeild|soul character)\b/.test(q)) return true;
  return /\b(text[- ]to[- ]image|text[- ]to[- ]video|generate (an |a )?(image|photo|video|clip|render)|make (me )?(an |a )?(image|video|clip)|create (an |a )?(image|video|clip)|kling|seedance|product (shot|photoshoot)|voiceover|voice clone|dubbing)\b/.test(
    q,
  );
}

function looksLikeGenerate(query: string): boolean {
  return /\b(generate|make|create|render|upscale|photoshoot|text[- ]to[- ]|image of|video of|photo of|clip of|voiceover|clone|dub)\b/i.test(
    query,
  );
}

function wantsVideo(query: string): boolean {
  return /\b(video|clip|reel|film|animate|motion|kling|seedance|text[- ]to[- ]video)\b/i.test(query);
}

function wantsAudio(query: string): boolean {
  return /\b(audio|voiceover|voice clone|dub|tts|soundtrack)\b/i.test(query);
}

function toolNamed(tools: McpTool[], ...names: string[]): McpTool | undefined {
  const want = names.map((n) => n.toLowerCase());
  return tools.find((t) => want.includes(t.name.toLowerCase()));
}

function toolMatching(tools: McpTool[], ...needles: string[]): McpTool | undefined {
  const want = needles.map((n) => n.toLowerCase());
  return tools.find((t) => {
    const name = t.name.toLowerCase();
    return want.some((n) => name === n || name.includes(n));
  });
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
  const urlsRaw = nested.urls ?? obj.urls ?? nested.output_urls;
  const urls = Array.isArray(urlsRaw) ? urlsRaw.filter((u): u is string => typeof u === "string") : [];
  const output = nested.output as { urls?: unknown; url?: unknown } | undefined;
  if (Array.isArray(output?.urls)) {
    for (const u of output.urls) if (typeof u === "string") urls.push(u);
  }
  if (typeof output?.url === "string") urls.push(output.url);
  if (typeof nested.url === "string") urls.push(nested.url);
  return {
    jobId: asId(nested.job_id) || asId(nested.jobId) || asId(obj.job_id) || asId(obj.jobId) || asId(nested.id),
    status: typeof nested.status === "string" ? nested.status : typeof obj.status === "string" ? obj.status : undefined,
    urls,
  };
}

function generateArgs(tool: McpTool, query: string): Record<string, unknown> {
  const props = tool.inputSchema?.properties || {};
  const prompt = query.trim();
  const args: Record<string, unknown> = {};
  if ("prompt" in props || !Object.keys(props).length) args.prompt = prompt;
  if ("aspect_ratio" in props) args.aspect_ratio = "16:9";
  if ("query" in props && !("prompt" in args)) args.query = prompt;
  if (!Object.keys(args).length) args.prompt = prompt;
  return args;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function formatDone(meta: { jobId?: string; status?: string; urls?: string[] }, fallback: string): string {
  const lines = [
    `Higgsfield ${meta.status || "job"}${meta.jobId ? ` · ${meta.jobId}` : ""}.`,
    ...(meta.urls || []).slice(0, 4),
  ];
  const body = lines.filter(Boolean).join("\n");
  return body.trim() ? body : fallback.slice(0, 3500);
}

async function pollJob(session: McpSession, tools: McpTool[], started: { text: string; result?: unknown }): Promise<string> {
  let meta = jobMeta(started.text, started.result);
  const getJob = toolMatching(tools, "get_job", "get-job", "job_status", "get_status");
  const terminal = /^(completed|succeeded|failed|canceled|cancelled|error|done)$/i;
  const t0 = Date.now();

  if (meta.jobId && getJob && !terminal.test(meta.status || "")) {
    for (let i = 0; i < POLL_ROUNDS; i++) {
      if (Date.now() - t0 > WALL_MS) break;
      const polled = await callMcpTool(session, getJob.name, { jobId: meta.jobId, job_id: meta.jobId }, { timeoutMs: 20_000 });
      if (!polled.ok) break;
      meta = { ...meta, ...jobMeta(polled.text, polled.result) };
      if (terminal.test(meta.status || "") || (meta.urls && meta.urls.length)) break;
      await sleep(POLL_GAP_MS);
    }
  }

  if (/^(failed|canceled|cancelled|error)$/i.test(meta.status || "") && !(meta.urls || []).length) {
    return `Higgsfield job ${meta.status}${meta.jobId ? ` (${meta.jobId})` : ""}. ${started.text.slice(0, 800)}`;
  }
  return formatDone(meta, started.text);
}

function pickGenerateTool(tools: McpTool[], query: string): McpTool | undefined {
  if (wantsAudio(query) && !wantsVideo(query)) {
    return toolMatching(tools, "generate_audio", "generate-audio") || toolNamed(tools, "generate");
  }
  if (wantsVideo(query)) {
    return toolMatching(tools, "generate_video", "generate-video") || toolNamed(tools, "generate");
  }
  return (
    toolMatching(tools, "generate_image", "generate-image") ||
    toolNamed(tools, "generate") ||
    toolMatching(tools, "generate")
  );
}

export async function runHiggsfieldForQuery(session: McpSession, query: string): Promise<string | null> {
  const tools = session.tools;
  if (!tools.length) return null;

  if (!looksLikeGenerate(query)) {
    const info =
      toolMatching(tools, "account_info", "account-info", "models_explore", "models-explore", "list_models") ||
      toolNamed(tools, "account_info");
    if (!info) return null;
    const found = await callMcpTool(session, info.name, argsForSearchTool(info, query), { timeoutMs: 20_000 });
    return found.ok ? found.text.slice(0, 2500) : found.text;
  }

  const generate = pickGenerateTool(tools, query);
  if (!generate) return "Higgsfield is connected but no generate tool is loaded.";

  const started = await callMcpTool(session, generate.name, generateArgs(generate, query), {
    timeoutMs: 25_000,
  });
  if (!started.ok) return `Higgsfield generate failed: ${started.text}`;
  return pollJob(session, tools, started);
}
