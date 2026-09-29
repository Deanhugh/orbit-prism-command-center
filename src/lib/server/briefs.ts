import { dataDir, loadConfig } from "./config";
import { readHub } from "./jarvis-hub";
import { localUsers } from "./auth";
import { JARVIS } from "../office-data";
import { shortId } from "../utils";
import { completePrompt } from "./llm";
import { loadAgentsConfig } from "./providers";
import { writeDeliverable } from "./brain";
import { dateKeyInZone, DEFAULT_TZ } from "./zone";
import type { BriefKind, StoredBrief, Task } from "../types";
import {
  formatClockHM,
  isSameDay,
  startOfDay,
  type JarvisHub,
} from "../jarvis-data";
import fs from "node:fs";
import path from "node:path";

const MAX_BRIEFS = 60;

function briefsFile() {
  return path.join(dataDir(), "briefs.json");
}

export function loadBriefs(): StoredBrief[] {
  try {
    const raw = JSON.parse(fs.readFileSync(briefsFile(), "utf8"));
    const list = Array.isArray(raw) ? raw : raw?.briefs;
    if (!Array.isArray(list)) return [];
    return list.filter((b) => b && b.kind && b.date);
  } catch {
    return [];
  }
}

function saveBriefs(list: StoredBrief[]): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(briefsFile(), JSON.stringify(list.slice(0, MAX_BRIEFS), null, 2));
  } catch {
    /* volume may be read-only */
  }
}

export function upsertBrief(brief: StoredBrief): StoredBrief {
  const rest = loadBriefs().filter((b) => !(b.kind === brief.kind && b.date === brief.date));
  rest.unshift(brief);
  saveBriefs(rest);
  return brief;
}

export function latestBrief(kind: BriefKind, date?: string): StoredBrief | null {
  const list = loadBriefs();
  if (date) return list.find((b) => b.kind === kind && b.date === date) || null;
  return list.find((b) => b.kind === kind) || null;
}

export function ownerContext(): { id: string; username: string; hub: JarvisHub; timezone: string } {
  const user = localUsers()[0];
  const id = user?.id || "office";
  const username = user?.username || "there";
  const hub = readHub(id, username);
  const timezone = hub.profile.timezone || DEFAULT_TZ;
  return { id, username, hub, timezone };
}

function statusLabel(status: Task["status"]): string {
  if (status === "waiting_approval") return "needs your OK";
  if (status === "in_progress") return "in progress";
  if (status === "blocked") return "blocked";
  if (status === "done") return "done";
  return status.replace("_", " ");
}

export interface BriefFacts {
  owner: string;
  timezone: string;
  date: string;
  dueToday: string[];
  overdue: string[];
  inMotion: string[];
  waitingOnYou: string[];
  waitingOnThem: string[];
  tomorrow: string[];
  doneToday: string[];
  calendar: string[];
}

export function collectBriefFacts(tasks: Task[], now = Date.now()): BriefFacts {
  const { hub, timezone, username } = ownerContext();
  const owner = hub.profile.ownerName || username;
  const date = dateKeyInZone(timezone, now);
  const open = tasks.filter((t) => t.status !== "done" && t.status !== "rejected" && t.status !== "stopped");
  const dueToday = open
    .filter((t) => isSameDay(t.createdAt, now) || isSameDay(t.updatedAt, now))
    .slice(0, 8)
    .map((t) => `${t.title} (${t.agentName} · ${statusLabel(t.status)})`);
  const overdue = open
    .filter((t) => t.createdAt < startOfDay(now) - 86400000 && t.status !== "in_progress")
    .slice(0, 6)
    .map((t) => `${t.title} (${t.agentName})`);
  const inMotion = open
    .filter((t) => t.status === "in_progress")
    .slice(0, 8)
    .map((t) => `${t.title} — ${t.agentName} (${t.progress}%)`);
  const waitingOnYou = [
    ...open.filter((t) => t.status === "waiting_approval").map((t) => `${t.title} — ${t.agentName} needs your OK`),
    ...(hub.replies ?? []).filter((r) => !r.done).map((r) => `${r.name} — ${r.note}`),
  ].slice(0, 8);
  const waitingOnThem = [
    ...open.filter((t) => /\b(chase|nudge|waiting on|follow.?up|overdue)\b/i.test(t.title)).map((t) => t.title),
    ...(hub.reminders ?? []).filter((r) => !r.done).map((r) => r.title),
  ].slice(0, 8);
  const tomorrow = (hub.extraEvents ?? [])
    .filter((e) => isSameDay(e.start, now + 86400000))
    .map((e) => `${formatClockHM(e.start)} ${e.title}`);
  const doneToday = tasks
    .filter((t) => t.status === "done" && isSameDay(t.updatedAt, now))
    .slice(0, 8)
    .map((t) => `${t.title} (${t.agentName})`);
  const calendar = (hub.extraEvents ?? [])
    .filter((e) => isSameDay(e.start, now))
    .sort((a, b) => a.start - b.start)
    .map((e) => `${formatClockHM(e.start)} ${e.title}${e.with ? ` with ${e.with}` : ""}`);

  return {
    owner,
    timezone,
    date,
    dueToday: dueToday.length ? dueToday : inMotion,
    overdue,
    inMotion,
    waitingOnYou,
    waitingOnThem,
    tomorrow,
    doneToday,
    calendar,
  };
}

function factsToSections(kind: BriefKind, facts: BriefFacts): StoredBrief["sections"] {
  const today = [
    ...facts.overdue.map((l) => `Slipped: ${l}`),
    ...facts.dueToday,
    ...facts.calendar.map((l) => `Calendar: ${l}`),
  ].filter(Boolean);
  return {
    today: today.length ? today : ["Board is clear."],
    waitingOnYou: facts.waitingOnYou.length ? facts.waitingOnYou : ["Nothing waiting on you."],
    waitingOnThem: facts.waitingOnThem.length ? facts.waitingOnThem : ["Nothing waiting on them."],
    tomorrow: facts.tomorrow.length ? facts.tomorrow : ["Nothing on the calendar tomorrow yet."],
    doneToday: kind === "evening" ? (facts.doneToday.length ? facts.doneToday : ["No desk marked work done today."]) : [],
  };
}

function narrativeFrom(kind: BriefKind, facts: BriefFacts): string {
  const greet = kind === "evening" ? "Good evening" : "Good morning";
  const bits = [
    `${greet}, ${facts.owner}.`,
    facts.overdue.length ? `${facts.overdue.length} slipped.` : "Nothing overdue from the desks.",
    facts.dueToday.length || facts.inMotion.length
      ? `${Math.max(facts.dueToday.length, facts.inMotion.length)} on the board.`
      : "The task board is clear.",
    facts.calendar[0] ? `Next block: ${facts.calendar[0]}.` : "",
    facts.waitingOnYou[0] && !facts.waitingOnYou[0].startsWith("Nothing")
      ? `Waiting on you: ${facts.waitingOnYou[0]}.`
      : "No one is waiting on a reply.",
    kind === "evening" && facts.doneToday.length ? `${facts.doneToday.length} closed today.` : "",
  ];
  return bits.filter(Boolean).join(" ");
}

function snapshotText(facts: BriefFacts): string {
  return [
    `Owner: ${facts.owner}`,
    `Date: ${facts.date}`,
    `Timezone: ${facts.timezone}`,
    facts.inMotion.length ? `In motion: ${facts.inMotion.join("; ")}` : "In motion: none",
    facts.dueToday.length ? `On the board: ${facts.dueToday.join("; ")}` : "On the board: none",
    facts.overdue.length ? `Slipped: ${facts.overdue.join("; ")}` : "Slipped: none",
    facts.waitingOnYou.length ? `Waiting on you: ${facts.waitingOnYou.join("; ")}` : "Waiting on you: none",
    facts.waitingOnThem.length ? `Waiting on them: ${facts.waitingOnThem.join("; ")}` : "Waiting on them: none",
    facts.doneToday.length ? `Done today: ${facts.doneToday.join("; ")}` : "Done today: none",
    facts.calendar.length ? `Calendar today: ${facts.calendar.join("; ")}` : "Calendar today: clear",
    facts.tomorrow.length ? `Tomorrow: ${facts.tomorrow.join("; ")}` : "Tomorrow: clear",
  ].join("\n");
}

function parseModelBrief(raw: string, fallback: StoredBrief["sections"]): StoredBrief["sections"] {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as Partial<StoredBrief["sections"]> & { narrative?: string };
    const list = (v: unknown, fb: string[]) =>
      Array.isArray(v) && v.every((x) => typeof x === "string") && v.length ? (v as string[]) : fb;
    return {
      today: list(parsed.today, fallback.today),
      waitingOnYou: list(parsed.waitingOnYou, fallback.waitingOnYou),
      waitingOnThem: list(parsed.waitingOnThem, fallback.waitingOnThem),
      tomorrow: list(parsed.tomorrow, fallback.tomorrow),
      doneToday: list(parsed.doneToday, fallback.doneToday),
    };
  } catch {
    return fallback;
  }
}

export async function composeBrief(opts: {
  kind: BriefKind;
  tasks: Task[];
  source: StoredBrief["source"];
  now?: number;
}): Promise<StoredBrief> {
  const now = opts.now ?? Date.now();
  const facts = collectBriefFacts(opts.tasks, now);
  const sections = factsToSections(opts.kind, facts);
  let narrative = narrativeFrom(opts.kind, facts);
  const cfg = loadConfig();
  const agents = loadAgentsConfig();
  if (agents.provider && agents.provider !== "demo") {
    const prompt = [
      `You are ${JARVIS.name}, ${JARVIS.role} of ${cfg.name}.`,
      `Write a ${opts.kind === "evening" ? "evening wrap" : "morning brief"} for ${facts.owner}.`,
      `Use ONLY the snapshot. Do not invent people, companies, or tasks.`,
      `Reply with JSON only: {"narrative":"2-4 sentences","today":["..."],"waitingOnYou":["..."],"waitingOnThem":["..."],"tomorrow":["..."],"doneToday":["..."]}.`,
      `Keep each array to at most 6 short bullets. Empty arrays are allowed.`,
      `SNAPSHOT:\n${snapshotText(facts)}`,
    ].join("\n\n");
    const out = await completePrompt({
      provider: agents.provider,
      model: agents.model || "demo",
      prompt,
      temperature: 0.3,
    });
    if (out) {
      const parsed = parseModelBrief(out, sections);
      Object.assign(sections, parsed);
      try {
        const blob = JSON.parse(out.match(/\{[\s\S]*\}/)?.[0] || "{}") as { narrative?: string };
        if (blob.narrative && blob.narrative.length > 20) narrative = blob.narrative;
      } catch {
        /* keep structured narrative */
      }
    }
  }

  const greet = opts.kind === "evening" ? "Good evening" : "Good morning";
  const body = [
    `${greet}, ${facts.owner}.`,
    "",
    narrative,
    "",
    "## Today",
    ...sections.today.map((l) => `- ${l}`),
    "",
    "## Waiting on you",
    ...sections.waitingOnYou.map((l) => `- ${l}`),
    "",
    "## Waiting on them",
    ...sections.waitingOnThem.map((l) => `- ${l}`),
    "",
    "## Tomorrow",
    ...sections.tomorrow.map((l) => `- ${l}`),
    ...(opts.kind === "evening"
      ? ["", "## Done today", ...sections.doneToday.map((l) => `- ${l}`)]
      : []),
  ].join("\n");

  const title = opts.kind === "evening" ? `Evening wrap ${facts.date}` : `Morning brief ${facts.date}`;
  const notePath = writeDeliverable(JARVIS.name, title, body, []) || undefined;

  const brief: StoredBrief = {
    id: shortId("b"),
    kind: opts.kind,
    date: facts.date,
    createdAt: now,
    timezone: facts.timezone,
    owner: facts.owner,
    greeting: `${greet}, ${facts.owner}.`,
    narrative,
    sections,
    notePath,
    source: opts.source,
  };
  return upsertBrief(brief);
}

export function liveFallbackBrief(kind: BriefKind, tasks: Task[], now = Date.now()): StoredBrief {
  const facts = collectBriefFacts(tasks, now);
  const sections = factsToSections(kind, facts);
  const greet = kind === "evening" ? "Good evening" : "Good morning";
  return {
    id: `live-${kind}`,
    kind,
    date: facts.date,
    createdAt: now,
    timezone: facts.timezone,
    owner: facts.owner,
    greeting: `${greet}, ${facts.owner}.`,
    narrative: narrativeFrom(kind, facts),
    sections,
    source: "on-demand",
  };
}
