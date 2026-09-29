import fs from "node:fs";
import path from "node:path";
import { dataDir, loadConfig } from "./config";
import { readHub } from "./jarvis-hub";
import { JARVIS } from "../office-data";
import { shortId } from "../utils";
import {
  formatClockHM,
  isSameDay,
  seedHabits,
  type JarvisHub,
} from "../jarvis-data";
import { composeBrief } from "./briefs";

export interface TodayLine {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const MAX_LINES = 80;

function chatPath(userId: string) {
  return path.join(dataDir(), `jarvis-today-${userId}.json`);
}

export function readTodayChat(userId: string): TodayLine[] {
  try {
    const raw = JSON.parse(fs.readFileSync(chatPath(userId), "utf8")) as TodayLine[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function writeTodayChat(userId: string, lines: TodayLine[]): TodayLine[] {
  fs.mkdirSync(dataDir(), { recursive: true });
  const next = lines.slice(-MAX_LINES);
  fs.writeFileSync(chatPath(userId), JSON.stringify(next, null, 2));
  return next;
}

export function appendTodayLine(userId: string, line: Omit<TodayLine, "id" | "ts"> & Partial<TodayLine>): TodayLine {
  const full: TodayLine = {
    id: line.id || shortId("j"),
    ts: line.ts || Date.now(),
    role: line.role,
    content: line.content,
  };
  writeTodayChat(userId, [...readTodayChat(userId), full]);
  return full;
}

export function todayBriefingText(userId: string, username: string, now = Date.now()): string {
  const hub = readHub(userId, username);
  return serializeBriefing(hub, username, now);
}

function serializeBriefing(hub: JarvisHub, username: string, now: number): string {
  const owner = hub.profile.ownerName || username;
  const events = [...(hub.extraEvents ?? [])].sort((a, b) => a.start - b.start);
  const habits = seedHabits();
  const done = new Set(hub.habitsDone ?? []);
  const todayEvents = events.filter((e) => isSameDay(e.start, now));
  const laterEvents = events.filter((e) => e.start > now).slice(0, 5);
  const reminders = (hub.reminders ?? []).filter((r) => !r.done).slice(0, 6);
  const replies = (hub.replies ?? []).filter((r) => !r.done).slice(0, 6);
  const goals = (hub.goals ?? []).slice(0, 6);
  const projects = (hub.projects ?? []).filter((p) => p.status !== "done").slice(0, 6);
  const notes = (hub.notes ?? []).slice(0, 4);
  const habitLine = habits
    .map((h) => `${done.has(h.id) ? "[x]" : "[ ]"} ${h.title} (${h.block})`)
    .join("; ");

  const lines = [
    `Owner: ${owner}`,
    `Clock: ${formatClockHM(now)}`,
    `Timezone: ${hub.profile.timezone}`,
    `Tagline: ${hub.profile.tagline}`,
    `Office board: see CURRENT OFFICE TASKS below or none yet`,
    todayEvents.length
      ? `Today's calendar: ${todayEvents.map((e) => `${formatClockHM(e.start)} ${e.title}${e.with ? ` with ${e.with}` : ""}`).join("; ")}`
      : "Today's calendar: clear",
    laterEvents.length
      ? `Next up: ${laterEvents.map((e) => `${formatClockHM(e.start)} ${e.title}`).join("; ")}`
      : "",
    reminders.length
      ? `Reminders: ${reminders.map((r) => `${r.title} (${formatClockHM(r.when)})`).join("; ")}`
      : "Reminders: none open",
    replies.length
      ? `People waiting on a reply: ${replies.map((r) => `${r.name} — ${r.note} (${r.daysWaiting}d)`).join("; ")}`
      : "People waiting: none",
    goals.length
      ? `Goals: ${goals.map((g) => `${g.title} (${g.progress}%, ${g.category})`).join("; ")}`
      : "",
    projects.length
      ? `Projects: ${projects.map((p) => `${p.title} — ${p.detail} (${p.progress}%)`).join("; ")}`
      : "",
    notes.length ? `Recent notes: ${notes.map((n) => n.title).join("; ")}` : "",
    habitLine ? `Habits: ${habitLine}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Snapshot-grounded reply when the configured model is offline. */
export function todayFallbackReply(userId: string, username: string, text: string, kind?: string): string {
  const hub = readHub(userId, username);
  const owner = hub.profile.ownerName || "there";
  const events = [...(hub.extraEvents ?? [])].sort((a, b) => a.start - b.start);
  const now = Date.now();
  const todayEvents = events.filter((e) => isSameDay(e.start, now));
  const next = todayEvents[0] || events.find((e) => e.start > now);
  const reminders = (hub.reminders ?? []).filter((r) => !r.done);
  const replies = (hub.replies ?? []).filter((r) => !r.done);
  const q = text.toLowerCase();
  const wantsBrief =
    kind === "brief" || /brief|plate|today|wrap|status|what.?s on|board|waiting/.test(q);

  if (/desktop|mark-?liv|open the |click |take over|wake word/.test(q)) {
    return "Not from this panel. I can brief you and talk here on the Orbit Prism model. Desktop control stays off the Command Center.";
  }
  if (/who.*(wait|repl)/.test(q) && replies[0]) {
    return `${replies[0].name} is waiting — ${replies[0].note}. ${replies.length > 1 ? `${replies.length - 1} more after that.` : "That is the only open reply."}`;
  }
  if (wantsBrief) {
    const bits = [
      `Good ${nowHourWord()}, ${owner}.`,
      replies[0] ? `${replies[0].name} is still waiting on you.` : "No one is waiting on a reply.",
      next ? `Next block: ${formatClockHM(next.start)} ${next.title}.` : "Calendar is quiet after this.",
      reminders[0] ? `Reminder: ${reminders[0].title}.` : "",
      "Ask Settings → Routines to put Morning Brief and Evening Wrap on a clock.",
    ];
    return bits.filter(Boolean).join(" ");
  }
  return `I am here, ${owner}. Ask for the brief, who is waiting, or tell me what to assign — CAD, Studio, CRM, PMO, Finance, or a post.`;
}

/** True when the owner is asking Jarvis to put a desk to work (not a brief / greeting). */
export function looksLikeOfficeTask(text: string, kind?: string): boolean {
  if (kind === "brief") return false;
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (/^(hi|hello|hey|thanks|thank you|ok|okay|good (morning|afternoon|evening))[\s!.]*$/i.test(t)) {
    return false;
  }
  const briefOnly =
    /\b(who is waiting|what'?s on|on the board|morning brief|evening wrap|what time|today'?s calendar|habit)\b/.test(t);
  const hasThenWork = /\b(and then|then |build|create|draft|make|assign)\b/.test(t);
  if (briefOnly && !hasThenWork) return false;
  if (
    /\b(build|create|draft|make|design|film|shoot|cut|post|invoice|bill|reconcil|cad|studio|deal|lead|prospect|research|write|run|assign|schedule|onboard|chase|publish|model|open a|log a|raise|enrich|propose|video|reel|part|bracket)\b/.test(
      t,
    )
  ) {
    return true;
  }
  if (/\b(i need|please |can you |have the |get the |tell the |ask the |go and )\b/.test(t) && t.split(/\s+/).length >= 4) {
    return true;
  }
  return false;
}

function nowHourWord() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

export function todaySystemPrompt(userId: string, username: string, kind?: string): string {
  const cfg = loadConfig();
  const snapshot = todayBriefingText(userId, username);
  const briefLine =
    kind === "brief"
      ? "The owner asked for a brief. Deliver a tight morning or evening brief from the snapshot — what slipped, what is next, who is waiting, and one recommended move. Do not invent items."
      : "If they ask what is on the board, brief from the snapshot. Stay in conversation otherwise.";

  return [
    `You are ${JARVIS.name}, the ${JARVIS.role} of ${cfg.name}. ${JARVIS.does}`,
    `You are speaking in the Command Center Today panel. Same character as the office Chief: concise, direct, operational.`,
    `You take typed and spoken instructions. When the owner asks for work, the office already dispatches it to the right desk — confirm the assignment in short spoken-friendly sentences.`,
    `You do not control the desktop, run Python, open apps, send system commands, or use Mark-LIV. If asked for those powers, say they are not on this panel.`,
    `Do not invent calendar items, people, or tasks that are not in the snapshot or this conversation.`,
    briefLine,
    `CURRENT COMMAND CENTER SNAPSHOT:\n${snapshot}`,
  ].join("\n\n");
}

export function resolveTodayPrompt(preset: string, text: string): { text: string; kind: "brief" | "chat" } {
  if (preset === "morning") {
    return { text: "Morning brief.", kind: "brief" };
  }
  if (preset === "evening") {
    return { text: "Evening wrap.", kind: "brief" };
  }
  if (preset === "waiting") {
    return { text: "Who is waiting?", kind: "chat" };
  }
  return { text: text.trim(), kind: "chat" };
}

export async function answerTodayChat(userId: string, username: string, text: string, kind: string): Promise<string> {
  if (kind === "brief" || /^(morning brief|evening wrap)\.?$/i.test(text.trim())) {
    const briefKind = /evening|wrap/i.test(text) ? "evening" : "morning";
    const { ensureStarted, listOfficeTasks, emitBrief } = await import("./runtime");
    await ensureStarted();
    const brief = await composeBrief({
      kind: briefKind,
      tasks: listOfficeTasks(),
      source: "on-demand",
    });
    emitBrief(brief);
    return brief.narrative;
  }

  if (looksLikeOfficeTask(text, kind)) {
    const { jarvisRoute } = await import("./runtime");
    const routed = await jarvisRoute(text);
    return routed.reply;
  }

  const { loadAgentsConfig } = await import("./providers");
  const { chatStream, providerStatus } = await import("./llm");
  const cfg = loadAgentsConfig();
  const status = await Promise.race([
    providerStatus(cfg.provider),
    new Promise<{ ok: boolean; reason: string }>((resolve) =>
      setTimeout(() => resolve({ ok: false, reason: "timeout" }), 700),
    ),
  ]);
  if (!status.ok) return todayFallbackReply(userId, username, text, kind);

  let mcpBlock = "";
  if (/\b(notion|wiki|workspace page|knowledge base)\b/i.test(text)) {
    try {
      const { formatMcpContext, mcpContextForQuery } = await import("./mcp-remote");
      mcpBlock = formatMcpContext(await mcpContextForQuery(text));
    } catch {
      mcpBlock = "";
    }
  }

  const history = readTodayChat(userId);
  const prior = history.filter((line) => !(line.role === "user" && line.content === text)).slice(-16);
  const system = [
    todaySystemPrompt(userId, username, kind),
    mcpBlock ? `LIVE MCP RESULTS:\n${mcpBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const messages = [
    { role: "system" as const, content: system },
    ...prior.map((line) => ({
      role: (line.role === "user" ? "user" : "assistant") as "user" | "assistant",
      content: line.content,
    })),
    { role: "user" as const, content: text },
  ];
  let content = "";
  for await (const ev of chatStream({
    provider: cfg.provider,
    model: cfg.model || "demo",
    messages,
    temperature: cfg.temperature,
  })) {
    if (ev.type === "token") content += ev.text;
    if (ev.type === "done") content = ev.content || content;
  }
  return content || todayFallbackReply(userId, username, text, kind);
}
