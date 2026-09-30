import { dataDir, loadConfig } from "./config";
import { readHub } from "./jarvis-hub";
import { localUsers } from "./auth";
import { JARVIS } from "../office-data";
import { shortId } from "../utils";
import { completePrompt } from "./llm";
import { loadAgentsConfig } from "./providers";
import { writeDeliverable } from "./brain";
import {
  DEFAULT_TZ,
  addDaysInZone,
  dateKeyInZone,
  formatClockInZone,
  formatWeekdayInZone,
  isSameDayInZone,
  startOfDayInZone,
} from "./zone";
import type { BriefKind, StoredBrief, Task } from "../types";
import { seedGoals, seedHabits, type JarvisHub } from "../jarvis-data";
import fs from "node:fs";
import path from "node:path";

const MAX_BRIEFS = 60;
const BRIEF_BLANK_GEN = 1;

function briefsFile() {
  return path.join(dataDir(), "briefs.json");
}

function readBriefsState(): { briefs: StoredBrief[]; blankGen: number } {
  try {
    const raw = JSON.parse(fs.readFileSync(briefsFile(), "utf8"));
    if (Array.isArray(raw)) return { briefs: raw.filter((b) => b && b.kind && b.date), blankGen: 0 };
    const list = Array.isArray(raw?.briefs) ? raw.briefs : [];
    return {
      briefs: list.filter((b: StoredBrief) => b && b.kind && b.date),
      blankGen: Number(raw?.blankGen) || 0,
    };
  } catch {
    return { briefs: [], blankGen: 0 };
  }
}

export function loadBriefs(): StoredBrief[] {
  const state = readBriefsState();
  if (state.blankGen < BRIEF_BLANK_GEN) {
    return persistBlankTodayMorning(state.briefs);
  }
  return state.briefs;
}

function saveBriefs(list: StoredBrief[], blankGen = BRIEF_BLANK_GEN): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(
      briefsFile(),
      JSON.stringify({ blankGen, briefs: list.slice(0, MAX_BRIEFS) }, null, 2),
    );
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
  const today = dateKeyInZone(DEFAULT_TZ);
  return list.find((b) => b.kind === kind && b.date === today) || list.find((b) => b.kind === kind) || null;
}

export function ownerContext(): { id: string; username: string; hub: JarvisHub; timezone: string } {
  const user = localUsers()[0];
  const id = user?.id || "office";
  const username = user?.username || "there";
  const hub = readHub(id, username);
  const timezone = hub.profile.timezone || DEFAULT_TZ;
  return { id, username, hub, timezone };
}

function emptyBriefSections(kind: BriefKind): StoredBrief["sections"] {
  return {
    today: ["Nothing on the board today."],
    waitingOnYou: ["Nothing waiting on you."],
    waitingOnThem: ["Nothing waiting on them."],
    tomorrow: ["Nothing on the calendar tomorrow yet."],
    doneToday: kind === "evening" ? ["No desk marked work done today."] : [],
  };
}

function briefOwnerLabel(): { owner: string; timezone: string } {
  const user = localUsers()[0];
  return { owner: user?.username || "there", timezone: DEFAULT_TZ };
}

function makeEmptyMorningBrief(
  now: number,
  owner: string,
  timezone: string,
  date: string,
  existing?: StoredBrief | null,
): StoredBrief {
  return {
    id: existing?.id || shortId("b"),
    kind: "morning",
    date,
    createdAt: existing?.createdAt ?? now,
    timezone,
    owner,
    greeting: `Good morning, ${owner}.`,
    narrative: `Good morning, ${owner}. The board is clear today.`,
    sections: emptyBriefSections("morning"),
    notePath: existing?.notePath,
    source: existing?.source || "on-demand",
  };
}

function persistBlankTodayMorning(list: StoredBrief[], now = Date.now()): StoredBrief[] {
  const { owner, timezone } = briefOwnerLabel();
  const date = dateKeyInZone(timezone, now);
  const wiped = list.map((b) =>
    b.kind === "morning"
      ? {
          ...b,
          sections: { ...emptyBriefSections("morning") },
          narrative:
            b.date === date ? `Good morning, ${owner}. The board is clear today.` : b.narrative,
        }
      : b,
  );
  const existing = wiped.find((b) => b.kind === "morning" && b.date === date) || null;
  const blank = makeEmptyMorningBrief(now, owner, timezone, date, existing);
  const rest = wiped.filter((b) => !(b.kind === "morning" && b.date === date));
  rest.unshift(blank);
  saveBriefs(rest, BRIEF_BLANK_GEN);
  return rest;
}

/** Wipe today's Morning Brief Today list (and the rest of that dated brief). */
export function clearMorningBriefForToday(now = Date.now()): StoredBrief {
  const state = readBriefsState();
  const list = persistBlankTodayMorning(state.briefs, now);
  const date = dateKeyInZone(DEFAULT_TZ, now);
  return list.find((b) => b.kind === "morning" && b.date === date) || list[0];
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
  habits: string[];
  goals: string[];
  projects: string[];
  knowledge: string[];
}

export function collectBriefFacts(
  tasks: Task[],
  now = Date.now(),
  ctx: { hub: JarvisHub; timezone: string; username: string } = ownerContext(),
): BriefFacts {
  const { hub, timezone, username } = ctx;
  const owner = hub.profile.ownerName || username;
  const date = dateKeyInZone(timezone, now);
  const clock = (ts: number) => formatClockInZone(ts, timezone);
  const tomorrowMs = addDaysInZone(timezone, now, 1);
  void tasks;
  const personalDue = (hub.extraTasks ?? []).filter((t) => t.status !== "done");
  const dueToday = personalDue
    .filter((t) => isSameDayInZone(t.due, now, timezone))
    .map((t) => `${t.title} (${clock(t.due)})`);
  const overdue = personalDue
    .filter((t) => t.due < startOfDayInZone(timezone, now))
    .map((t) => t.title);
  const inMotion: string[] = [];
  const waitingOnYou = (hub.replies ?? []).filter((r) => !r.done).map((r) => `${r.name} — ${r.note}`).slice(0, 8);
  const waitingOnThem = (hub.reminders ?? [])
    .filter((r) => !r.done)
    .map((r) => `${r.title} (${clock(r.when)})`)
    .slice(0, 8);
  const weekOut = addDaysInZone(timezone, now, 7);
  const tomorrowExact = [
    ...(hub.extraEvents ?? [])
      .filter((e) => isSameDayInZone(e.start, tomorrowMs, timezone))
      .map((e) => `${clock(e.start)} ${e.title}`),
    ...personalDue
      .filter((t) => isSameDayInZone(t.due, tomorrowMs, timezone))
      .map((t) => `${t.title} (${clock(t.due)})`),
  ];
  const laterEvents = (hub.extraEvents ?? [])
    .filter((e) => e.start > tomorrowMs && e.start < weekOut && !isSameDayInZone(e.start, tomorrowMs, timezone))
    .sort((a, b) => a.start - b.start);
  const laterWeek = [
    ...laterEvents.map((e) => `${formatWeekdayInZone(e.start, timezone)} ${clock(e.start)} ${e.title}`),
    ...personalDue
      .filter(
        (t) =>
          t.due > tomorrowMs &&
          t.due < weekOut &&
          !isSameDayInZone(t.due, tomorrowMs, timezone) &&
          !laterEvents.some((e) => e.title === t.title && isSameDayInZone(e.start, t.due, timezone)),
      )
      .sort((a, b) => a.due - b.due)
      .map((t) => `${formatWeekdayInZone(t.due, timezone)} ${t.title}`),
  ];
  const tomorrow = [...tomorrowExact, ...laterWeek];
  const doneToday = (hub.extraTasks ?? [])
    .filter((t) => t.status === "done" && isSameDayInZone(t.due, now, timezone))
    .slice(0, 8)
    .map((t) => t.title);
  const calendar = (hub.extraEvents ?? [])
    .filter((e) => isSameDayInZone(e.start, now, timezone))
    .sort((a, b) => a.start - b.start)
    .map((e) => `${clock(e.start)} ${e.title}${e.with ? ` with ${e.with}` : ""}`);
  const extraHabits = hub.extraHabits ?? [];
  const habits = extraHabits.map((h) => {
    const marked = (hub.habitsDone ?? []).includes(h.id);
    return `${marked ? "[x]" : "[ ]"} ${h.title} (${h.block})`;
  });
  const goals = (hub.goals ?? []).slice(0, 6).map((g) => `${g.title} (${g.progress}%, ${g.category})`);
  const projects = (hub.projects ?? [])
    .filter((p) => p.status !== "done")
    .slice(0, 6)
    .map((p) => p.title);
  const knowledge = (hub.articles ?? []).slice(0, 4).map((a) => a.title);

  return {
    owner,
    timezone,
    date,
    dueToday,
    overdue,
    inMotion,
    waitingOnYou,
    waitingOnThem,
    tomorrow,
    doneToday,
    calendar,
    habits,
    goals,
    projects,
    knowledge,
  };
}

function personalHabitLines(facts: BriefFacts): string[] {
  const seeds = new Set(seedHabits().map((h) => h.title.toLowerCase()));
  return facts.habits
    .filter((line) => {
      const title = line.replace(/^\[[ x]\]\s+/i, "").replace(/\s+\([^)]+\)\s*$/, "");
      return title && !seeds.has(title.toLowerCase());
    })
    .slice(0, 4)
    .map((l) => `Habit: ${l}`);
}

function personalGoalLines(facts: BriefFacts): string[] {
  const seeds = new Set(seedGoals().map((g) => g.title.toLowerCase()));
  return facts.goals
    .filter((line) => {
      const title = line.replace(/\s+\([^)]+\)\s*$/, "");
      return title && !seeds.has(title.toLowerCase());
    })
    .slice(0, 4)
    .map((l) => `Goal: ${l}`);
}

function factsToSections(kind: BriefKind, facts: BriefFacts): StoredBrief["sections"] {
  const today = [
    ...facts.overdue.map((l) => `Slipped: ${l}`),
    ...facts.dueToday,
    ...facts.calendar.map((l) => `Calendar: ${l}`),
    ...personalHabitLines(facts),
    ...personalGoalLines(facts),
    ...facts.projects.slice(0, 4).map((l) => `Project: ${l}`),
    ...facts.knowledge.slice(0, 3).map((l) => `Saved: ${l}`),
  ].filter(Boolean);
  return {
    today: today.length ? today : ["Nothing on the board today."],
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
    facts.habits.length ? `Habits: ${facts.habits.join("; ")}` : "",
    facts.goals.length ? `Goals: ${facts.goals.join("; ")}` : "",
    facts.projects.length ? `Projects: ${facts.projects.join("; ")}` : "",
    facts.knowledge.length ? `Knowledge: ${facts.knowledge.join("; ")}` : "",
  ].filter(Boolean).join("\n");
}

/** Rewrite today's stored briefs from the live hub so voice updates appear immediately. */
export function refreshTodayBriefs(
  tasks: Task[],
  now = Date.now(),
  ctx?: { hub: JarvisHub; timezone: string; username: string },
  highlights: string[] = [],
): StoredBrief[] {
  const facts = collectBriefFacts(tasks, now, ctx ?? ownerContext());
  const out: StoredBrief[] = [];
  for (const kind of ["morning", "evening"] as const) {
    const existing = latestBrief(kind, facts.date);
    const sections = factsToSections(kind, facts);
    let narrative = existing?.narrative || narrativeFrom(kind, facts);
    const mention = highlights.find((h) => h && !narrative.toLowerCase().includes(h.toLowerCase()));
    if (mention && existing) {
      narrative = `${narrative.replace(/\s+$/, "").replace(/( Latest: [^.]+.)+$/g, "")} Latest: ${mention}.`;
    }
    const greet = kind === "evening" ? "Good evening" : "Good morning";
    out.push(
      upsertBrief({
        id: existing?.id || shortId("b"),
        kind,
        date: facts.date,
        createdAt: existing?.createdAt ?? now,
        timezone: facts.timezone,
        owner: facts.owner,
        greeting: existing?.greeting || `${greet}, ${facts.owner}.`,
        narrative,
        sections,
        notePath: existing?.notePath,
        source: existing?.source || "on-demand",
      }),
    );
  }
  return out;
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
