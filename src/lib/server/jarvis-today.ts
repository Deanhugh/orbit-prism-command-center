import fs from "node:fs";
import path from "node:path";
import { dataDir, loadConfig } from "./config";
import { readHub } from "./jarvis-hub";
import { JARVIS } from "../office-data";
import { shortId } from "../utils";
import {
  formatClockHM,
  isSameDay,
  seedEvents,
  seedHabits,
  seedTasks,
  startOfDay,
  type JarvisHub,
} from "../jarvis-data";

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
  const events = [...seedEvents(), ...(hub.extraEvents ?? [])].sort((a, b) => a.start - b.start);
  const tasks = seedTasks();
  const habits = seedHabits();
  const done = new Set(hub.habitsDone ?? []);
  const todayTasks = tasks.filter((t) => isSameDay(t.due, now) && t.status !== "done");
  const overdue = tasks.filter((t) => t.due < startOfDay(now) && t.status !== "done");
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
    todayTasks.length
      ? `Due today: ${todayTasks.map((t) => `${t.title} (${t.project || "no project"}, ${t.status})`).join("; ")}`
      : "Due today: none",
    overdue.length ? `Overdue: ${overdue.map((t) => t.title).join("; ")}` : "Overdue: none",
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
  const now = Date.now();
  const owner = hub.profile.ownerName || "there";
  const events = [...seedEvents(), ...(hub.extraEvents ?? [])].sort((a, b) => a.start - b.start);
  const tasks = seedTasks();
  const todayTasks = tasks.filter((t) => isSameDay(t.due, now) && t.status !== "done");
  const overdue = tasks.filter((t) => t.due < startOfDay(now) && t.status !== "done");
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
      overdue.length ? `${overdue.length} slipped.` : "Nothing overdue.",
      todayTasks.length
        ? `${todayTasks.length} on the board today, starting with ${todayTasks[0].title}.`
        : "The task board is clear.",
      next ? `Next block: ${formatClockHM(next.start)} ${next.title}.` : "Calendar is quiet after this.",
      replies[0] ? `${replies[0].name} is still waiting on you.` : "No one is waiting on a reply.",
      reminders[0] ? `Reminder: ${reminders[0].title}.` : "",
    ];
    return bits.filter(Boolean).join(" ");
  }
  return `I am here, ${owner}. Ask for the brief, who is waiting, or what is next on the calendar.`;
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
    `You are speaking only in the Command Center Today panel. Same character as the office Chief: concise, direct, operational.`,
    `You have conversation, briefing, and hybrid type/talk. Write in short spoken-friendly sentences.`,
    `You do not control the desktop, run Python, open apps, send system commands, or use Mark-LIV. If asked for those powers, say they are not on this panel.`,
    `Do not invent calendar items, people, or tasks that are not in the snapshot or this conversation.`,
    briefLine,
    `CURRENT COMMAND CENTER SNAPSHOT:\n${snapshot}`,
  ].join("\n\n");
}

export function resolveTodayPrompt(preset: string, text: string): { text: string; kind: "brief" | "chat" } {
  if (preset === "morning") {
    return { text: "Give me the morning brief from the Command Center snapshot.", kind: "brief" };
  }
  if (preset === "evening") {
    return { text: "Give me the evening wrap from the Command Center snapshot.", kind: "brief" };
  }
  if (preset === "waiting") {
    return { text: "Who is waiting on a reply?", kind: "chat" };
  }
  return { text: text.trim(), kind: "chat" };
}

export async function answerTodayChat(userId: string, username: string, text: string, kind: string): Promise<string> {
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

  const history = readTodayChat(userId);
  const prior = history.filter((line) => !(line.role === "user" && line.content === text)).slice(-16);
  const messages = [
    { role: "system" as const, content: todaySystemPrompt(userId, username, kind) },
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
