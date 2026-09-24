import {
  PRESETS,
  type ProviderId,
  apiKeyFor,
  baseUrlFor,
} from "./providers";
import { claudePrompt, claudeStatus } from "./claude";

export interface ChatMsg {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
}

export type StreamEvent =
  | { type: "token"; text: string }
  | { type: "tool"; name: string; status: "running" | "done" | "error"; detail?: string }
  | { type: "done"; content: string }
  | { type: "error"; error: string };

// OpenAI-compatible tool schema (function calling)
export interface ToolSchema {
  type: "function";
  function: { name: string; description?: string; parameters?: unknown };
}

interface ChatOpts {
  provider: ProviderId;
  model: string;
  messages: ChatMsg[];
  temperature?: number;
  tools?: ToolSchema[];
  execTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
}

function urlVariants(base: string): string[] {
  const out = [base];
  if (base.includes("localhost")) out.push(base.replace("localhost", "127.0.0.1"));
  if (base.includes("127.0.0.1")) out.push(base.replace("127.0.0.1", "localhost"));
  return [...new Set(out)];
}

function originFromOpenAiBase(base: string): string {
  return base.replace(/\/v1\/?$/, "");
}

export async function providerStatus(id: ProviderId): Promise<{ ok: boolean; reason: string }> {
  if (id === "demo") return { ok: true, reason: "demo mode" };
  if (id === "claude") {
    const s = await claudeStatus();
    return { ok: s.available, reason: s.reason };
  }
  const def = PRESETS[id];
  const base = baseUrlFor(id);
  if (!base) return { ok: false, reason: "no base URL" };
  if (def.keyName && !apiKeyFor(id)) return { ok: false, reason: `${def.keyName} not set` };
  if (/ollama\.com/i.test(base) && (!apiKeyFor(id) || apiKeyFor(id) === "local")) {
    return { ok: false, reason: "OLLAMA_API_KEY not set — needed for Ollama Cloud" };
  }
  let last = def.local ? `${def.label} not running` : "unreachable";
  for (const b of urlVariants(base)) {
    try {
      const res = await fetch(`${b}/models`, {
        headers: authHeaders(id),
        signal: AbortSignal.timeout(1500),
      });
      if (res.ok) return { ok: true, reason: "reachable" };
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = def.local ? `${def.label} not running` : String(e).slice(0, 60);
    }
  }
  return { ok: false, reason: last };
}

export async function listModels(id: ProviderId): Promise<string[]> {
  if (id === "claude") return ["sonnet", "opus", "fable"];
  if (id === "demo") return ["demo"];
  const base = baseUrlFor(id);
  if (!base) return [];
  const names = new Set<string>();
  for (const b of urlVariants(base)) {
    try {
      const res = await fetch(`${b}/models`, {
        headers: authHeaders(id),
        signal: AbortSignal.timeout(2000),
      });
      if (res.ok) {
        const data = await res.json();
        for (const m of data.data || []) {
          if (m?.id) names.add(String(m.id));
        }
      }
    } catch {
      /* try the next URL */
    }
    if (id === "ollama") {
      try {
        const res = await fetch(`${originFromOpenAiBase(b)}/api/tags`, {
          signal: AbortSignal.timeout(2000),
        });
        if (res.ok) {
          const data = await res.json();
          for (const m of data.models || []) {
            const n = m?.name || m?.model;
            if (n) names.add(String(n));
          }
        }
      } catch {
        /* Ollama not on this host */
      }
    }
  }
  return [...names];
}

function authHeaders(id: ProviderId): Record<string, string> {
  const key = apiKeyFor(id);
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (key) h["Authorization"] = `Bearer ${key}`;
  return h;
}

/** Main entry: streams tokens + tool steps, runs a tool-calling loop, ends with 'done'. */
export async function* chatStream(opts: ChatOpts): AsyncGenerator<StreamEvent> {
  try {
    if (opts.provider === "demo") {
      yield* demoStream(opts);
      return;
    }
    if (opts.provider === "claude") {
      const s = await claudeStatus();
      if (!s.available) { yield* demoStream(opts); return; }
      yield* claudeStream(opts);
      return;
    }
    // OpenAI-compatible: fall back to demo if the backend isn't reachable
    const status = await providerStatus(opts.provider);
    if (!status.ok) {
      yield* demoStream(opts);
      return;
    }
    yield* openaiCompatStream(opts);
  } catch (e) {
    yield { type: "error", error: String(e).slice(0, 200) };
  }
}

async function* openaiCompatStream(opts: ChatOpts): AsyncGenerator<StreamEvent> {
  const base = baseUrlFor(opts.provider);
  const messages = [...opts.messages];
  let finalContent = "";

  for (let round = 0; round < 4; round++) {
    const body: Record<string, unknown> = {
      model: opts.model,
      messages,
      temperature: opts.temperature ?? 0.6,
      stream: true,
    };
    if (opts.tools?.length) {
      body.tools = opts.tools;
      body.tool_choice = "auto";
    }

    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: authHeaders(opts.provider),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => "");
      yield { type: "error", error: `HTTP ${res.status} ${text.slice(0, 160)}` };
      return;
    }

    let content = "";
    const toolCalls = new Map<number, { id: string; name: string; args: string }>();
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let done = false;
    while (!done) {
      const { value, done: d } = await reader.read();
      if (d) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() || "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") { done = true; break; }
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta;
          if (delta?.content) {
            content += delta.content;
            yield { type: "token", text: delta.content };
          }
          for (const tc of delta?.tool_calls || []) {
            const idx = tc.index ?? 0;
            const cur = toolCalls.get(idx) || { id: tc.id || "", name: "", args: "" };
            if (tc.id) cur.id = tc.id;
            if (tc.function?.name) cur.name = tc.function.name;
            if (tc.function?.arguments) cur.args += tc.function.arguments;
            toolCalls.set(idx, cur);
          }
        } catch {
          /* skip malformed */
        }
      }
    }

    finalContent += content;

    if (toolCalls.size && opts.execTool) {
      messages.push({
        role: "assistant",
        content: content || "",
        // @ts-expect-error tool_calls attached for the follow-up round
        tool_calls: [...toolCalls.values()].map((c) => ({
          id: c.id, type: "function", function: { name: c.name, arguments: c.args },
        })),
      });
      for (const c of toolCalls.values()) {
        yield { type: "tool", name: c.name, status: "running" };
        let result = "";
        try {
          const args = c.args ? JSON.parse(c.args) : {};
          result = await opts.execTool(c.name, args);
          yield { type: "tool", name: c.name, status: "done", detail: result.slice(0, 80) };
        } catch (e) {
          result = `error: ${String(e).slice(0, 80)}`;
          yield { type: "tool", name: c.name, status: "error", detail: result };
        }
        messages.push({ role: "tool", tool_call_id: c.id, name: c.name, content: result });
      }
      continue; // next round with tool results
    }
    break; // no tools -> finished
  }

  yield { type: "done", content: finalContent };
}

async function* claudeStream(opts: ChatOpts): AsyncGenerator<StreamEvent> {
  const prompt = opts.messages
    .map((m) => (m.role === "system" ? m.content : `${m.role.toUpperCase()}: ${m.content}`))
    .join("\n\n");
  const out = (await claudePrompt(prompt, 120000)) || "";
  if (!out) { yield { type: "error", error: "Claude returned nothing" }; return; }
  // chunk into word-ish tokens for a streaming feel
  const parts = out.match(/\S+\s*/g) || [out];
  for (const p of parts) {
    yield { type: "token", text: p };
    await sleep(12);
  }
  yield { type: "done", content: out };
}

async function* demoStream(opts: ChatOpts): AsyncGenerator<StreamEvent> {
  const last = [...opts.messages].reverse().find((m) => m.role === "user");
  const sys = opts.messages.find((m) => m.role === "system")?.content || "";
  const who = /You are ([^,\n.]+)/.exec(sys)?.[1] || "the agent";
  const task = last?.content || "your request";
  // simulate a couple of tool steps if tools present
  if (opts.tools?.length) {
    for (const t of opts.tools.slice(0, 2)) {
      yield { type: "tool", name: t.function.name, status: "running" };
      await sleep(500);
      yield { type: "tool", name: t.function.name, status: "done", detail: "ok" };
    }
  }
  const reply = `On it — this is ${who} in demo mode. With Ollama running (local qwen2.5:7b or a :cloud model), I'd handle "${truncate(task, 80)}" for real, grounded in your Brain and using the connected tools. Connect Ollama in Settings to go live.`;
  const parts = reply.match(/\S+\s*/g) || [reply];
  for (const p of parts) {
    yield { type: "token", text: p };
    await sleep(18);
  }
  yield { type: "done", content: reply };
}

function truncate(s: string, n: number) { return s.length > n ? s.slice(0, n) + "…" : s; }
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
