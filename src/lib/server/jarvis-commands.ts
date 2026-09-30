import { shortId } from "../utils";
import {
  type JarvisEvent,
  type JarvisGoal,
  type JarvisHabit,
  type JarvisHub,
  type JarvisReminder,
  type JarvisTask,
} from "../jarvis-data";
import { patchHub, readHub } from "./jarvis-hub";
import { refreshTodayBriefs } from "./briefs";
import {
  DEFAULT_TZ,
  addDaysInZone,
  dateKeyInZone,
  formatClockInZone,
  formatWeekdayInZone,
  isSameDayInZone,
  partsInZone,
  zonedWallToUtc,
} from "./zone";

export type PersonalSurface = "calendar" | "task" | "habit" | "goal" | "reminder";

export interface ParsedPersonalCommand {
  action: "add" | "clear";
  surfaces: PersonalSurface[];
  title: string;
  when: number;
  end: number;
  timeKnown: boolean;
  habitBlock: JarvisHabit["block"];
  goalCategory: string;
}

export interface AppliedPersonalUpdate {
  action: "add" | "clear";
  surfaces: PersonalSurface[];
  title: string;
  when: number;
  reply: string;
  cleared?: number;
  event?: JarvisEvent;
  task?: JarvisTask;
  habit?: JarvisHabit;
  goal?: JarvisGoal;
  reminder?: JarvisReminder;
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const MONTHS: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sep: 9,
  sept: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const SURFACE_RE =
  /\b(calendar|calander|calender|agenda|to-?dos?|tasks?|habits?|goals?|reminders?)\b|\bremind me\b|\bon my (day|plate|calendar|calander|calender)\b/i;
const ACTION_RE =
  /\b(add|put|set|create|update|log|track|schedule|book|move|remember|remind|pencil|write)\b/i;
const CLEAR_RE =
  /\b(clear|cleared|delete|remove|wipe|empty|reset|drop)\b|\bget rid of\b|\bno more\b|\btake (them|it|all) off\b/i;
const ALL_SECTIONS_RE =
  /\b(everything|every section|all (of )?(it|them|sections)|the (whole )?(board|deck|dashboard|hub))\b/i;
const GENERIC_TITLES = new Set([
  "personal item",
  "all",
  "section",
  "item",
  "items",
  "ones",
  "one",
  "everything",
  "dashboard",
  "board",
  "deck",
  "hub",
]);
const DATE_RE =
  /\b(today|tonight|tomorrow|monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun|next week|this week)\b/i;
const APPOINTMENT_RE =
  /\b(appointment|dentist|doctor|haircut|pickup|drop[- ]off|errand)\b/i;
const INQUIRY_RE =
  /\b(what'?s|what is|who is|show me|list|on the board|morning brief|evening wrap)\b/i;
const OFFICE_DESK_RE =
  /\b(cad|studio|invoice|scrape|apify|krea|notion|github|film|reel|bracket|plane ticket|enrich a lead|reconcil)\b/i;

export function looksLikePersonalUpdate(text: string, kind?: string): boolean {
  if (kind === "brief") return false;
  const t = text.toLowerCase().trim();
  if (!t) return false;
  if (INQUIRY_RE.test(t) && !ACTION_RE.test(t) && !CLEAR_RE.test(t)) return false;
  if (OFFICE_DESK_RE.test(t) && !SURFACE_RE.test(t) && !CLEAR_RE.test(t)) return false;
  const hasSurface = SURFACE_RE.test(t);
  const hasAction = ACTION_RE.test(t);
  const hasClear = CLEAR_RE.test(t);
  const hasDate = DATE_RE.test(t) || hasMonthDay(t) || /\bon the \d{1,2}(st|nd|rd|th)?\b/.test(t);
  const hasAppointment = APPOINTMENT_RE.test(t);
  if (hasClear && (hasSurface || ALL_SECTIONS_RE.test(t))) return true;
  if (hasSurface && hasAction) return true;
  if (hasSurface && hasDate) return true;
  if (hasAppointment && (hasAction || hasDate)) return true;
  if (hasDate && hasAction && /\b(task|meeting|call|block|event|reminder)\b/i.test(t)) return true;
  return false;
}

export function isClearIntent(text: string): boolean {
  return CLEAR_RE.test(text);
}

export function parsePersonalCommand(
  text: string,
  timeZone = DEFAULT_TZ,
  now = Date.now(),
): ParsedPersonalCommand | null {
  if (!looksLikePersonalUpdate(text)) return null;
  const tz = timeZone || DEFAULT_TZ;
  const action: ParsedPersonalCommand["action"] = isClearIntent(text) ? "clear" : "add";
  const surfaces = inferSurfaces(text, action);
  if (action === "clear" && surfaces.length === 0) return null;
  const time = parseTimeOfDay(text);
  const day = parseDay(text, tz, now);
  const hour = time?.hour ?? defaultHour(text, surfaces);
  const minute = time?.minute ?? 0;
  const start = zonedWallToUtc(tz, day.year, day.month, day.day, hour, minute);
  const durationMin = /\ball[- ]day\b/i.test(text) ? 8 * 60 : /\bhour\b/i.test(text) ? 60 : 30;
  const endParts = addMinutes(day.year, day.month, day.day, hour, minute, durationMin);
  const end = zonedWallToUtc(tz, endParts.year, endParts.month, endParts.day, endParts.hour, endParts.minute);
  const title = extractTitle(text);
  return {
    action,
    surfaces,
    title,
    when: start,
    end,
    timeKnown: Boolean(time),
    habitBlock: inferHabitBlock(text, hour),
    goalCategory: inferGoalCategory(text),
  };
}

export async function applyPersonalCommand(
  userId: string,
  username: string,
  text: string,
  now = Date.now(),
): Promise<AppliedPersonalUpdate | null> {
  const hub = readHub(userId, username);
  const tz = hub.profile.timezone || DEFAULT_TZ;
  const parsed = parsePersonalCommand(text, tz, now);
  if (!parsed) return null;

  if (parsed.action === "clear") {
    return applyClearCommand(userId, username, hub, parsed, now);
  }

  const patch: Partial<JarvisHub> = {};
  const applied: AppliedPersonalUpdate = {
    action: "add",
    surfaces: parsed.surfaces,
    title: parsed.title,
    when: parsed.when,
    reply: "",
  };

  if (parsed.surfaces.includes("calendar")) {
    const event: JarvisEvent = {
      id: shortId("e"),
      title: parsed.title,
      start: parsed.when,
      end: parsed.end,
      calendar: "Personal",
    };
    if (!alreadyHasEvent(hub.extraEvents ?? [], event, tz)) {
      patch.extraEvents = [...(hub.extraEvents ?? []), event];
      applied.event = event;
    } else {
      applied.event = (hub.extraEvents ?? []).find(
        (e) => normalizeTitle(e.title) === normalizeTitle(event.title) && isSameDayInZone(e.start, event.start, tz),
      );
    }
  }

  if (parsed.surfaces.includes("task")) {
    const task: JarvisTask = {
      id: shortId("t"),
      title: parsed.title,
      project: "Personal",
      due: parsed.when,
      progress: 0,
      status: "todo",
      priority: "normal",
    };
    if (!alreadyHasTask(hub.extraTasks ?? [], task, tz)) {
      patch.extraTasks = [...(hub.extraTasks ?? []), task];
      applied.task = task;
    } else {
      applied.task = (hub.extraTasks ?? []).find(
        (t) => normalizeTitle(t.title) === normalizeTitle(task.title) && isSameDayInZone(t.due, task.due, tz),
      );
    }
  }

  if (parsed.surfaces.includes("habit")) {
    const habit: JarvisHabit = {
      id: shortId("h"),
      title: parsed.title,
      block: parsed.habitBlock,
    };
    const existing = (hub.extraHabits ?? []).find((h) => normalizeTitle(h.title) === normalizeTitle(habit.title));
    if (!existing) {
      patch.extraHabits = [...(hub.extraHabits ?? []), habit];
      applied.habit = habit;
    } else {
      applied.habit = existing;
    }
  }

  if (parsed.surfaces.includes("goal")) {
    const goal: JarvisGoal = {
      id: shortId("g"),
      title: parsed.title,
      category: parsed.goalCategory,
      daysLeft: null,
      progress: 0,
    };
    const existing = (hub.goals ?? []).find((g) => normalizeTitle(g.title) === normalizeTitle(goal.title));
    if (!existing) {
      patch.goals = [...(hub.goals ?? []), goal];
      applied.goal = goal;
    } else {
      applied.goal = existing;
    }
  }

  if (parsed.surfaces.includes("reminder")) {
    const reminder: JarvisReminder = {
      id: shortId("r"),
      title: parsed.title,
      when: parsed.when,
      done: false,
    };
    if (!alreadyHasReminder(hub.reminders ?? [], reminder, tz)) {
      patch.reminders = [...(hub.reminders ?? []), reminder];
      applied.reminder = reminder;
    } else {
      applied.reminder = (hub.reminders ?? []).find(
        (r) => normalizeTitle(r.title) === normalizeTitle(reminder.title) && isSameDayInZone(r.when, reminder.when, tz),
      );
    }
  }

  const saved = Object.keys(patch).length ? patchHub(userId, username, patch) : hub;

  try {
    const { emitBrief, listOfficeTasks } = await import("./runtime");
    const briefs = refreshTodayBriefs(
      listOfficeTasks(),
      now,
      {
        hub: saved,
        username,
        timezone: saved.profile.timezone || DEFAULT_TZ,
      },
      [parsed.title],
    );
    for (const brief of briefs) emitBrief(brief);
  } catch {
    /* office runtime may be cold; hub write still stands */
  }

  applied.reply = confirmReply(applied, tz);
  return applied;
}

async function applyClearCommand(
  userId: string,
  username: string,
  hub: JarvisHub,
  parsed: ParsedPersonalCommand,
  now: number,
): Promise<AppliedPersonalUpdate> {
  const tz = hub.profile.timezone || DEFAULT_TZ;
  const specific = isSpecificTitle(parsed.title);
  const patch: Partial<JarvisHub> = {};
  let cleared = 0;

  for (const surface of parsed.surfaces) {
    if (surface === "calendar") {
      const list = hub.extraEvents ?? [];
      const next = specific ? list.filter((e) => !titleMatch(e.title, parsed.title)) : [];
      cleared += list.length - next.length;
      patch.extraEvents = next;
      if (!specific) {
        if (!hub.suppressSeeds?.calendar) cleared += 1;
        patch.suppressSeeds = { ...hub.suppressSeeds, ...patch.suppressSeeds, calendar: true };
      }
    }
    if (surface === "task") {
      const list = hub.extraTasks ?? [];
      const next = specific ? list.filter((t) => !titleMatch(t.title, parsed.title)) : [];
      cleared += list.length - next.length;
      patch.extraTasks = next;
    }
    if (surface === "habit") {
      const list = hub.extraHabits ?? [];
      const next = specific ? list.filter((h) => !titleMatch(h.title, parsed.title)) : [];
      const removed = list.filter((h) => !next.some((n) => n.id === h.id));
      cleared += removed.length;
      patch.extraHabits = next;
      patch.habitsDone = specific
        ? (hub.habitsDone ?? []).filter((id) => !removed.some((h) => h.id === id))
        : [];
      if (!specific) {
        if (!hub.suppressSeeds?.habits) cleared += 1;
        patch.suppressSeeds = { ...hub.suppressSeeds, ...patch.suppressSeeds, habits: true };
      }
    }
    if (surface === "goal") {
      const list = hub.goals ?? [];
      const next = specific ? list.filter((g) => !titleMatch(g.title, parsed.title)) : [];
      cleared += list.length - next.length;
      patch.goals = next;
    }
    if (surface === "reminder") {
      const list = hub.reminders ?? [];
      const next = specific ? list.filter((r) => !titleMatch(r.title, parsed.title)) : [];
      cleared += list.length - next.length;
      patch.reminders = next;
    }
  }

  const saved = Object.keys(patch).length ? patchHub(userId, username, patch) : hub;
  const labels: Record<PersonalSurface, string> = {
    calendar: "Calendar",
    task: "Tasks",
    habit: "Habits",
    goal: "Goals",
    reminder: "Reminders",
  };
  const places = parsed.surfaces.map((s) => labels[s]).join(" and ");
  let reply: string;
  if (specific && cleared === 0) {
    reply = `I did not find ${parsed.title} on ${places}.`;
  } else if (specific) {
    reply = `Removed ${parsed.title} from ${places}.`;
  } else if (cleared === 0) {
    reply = `${places} ${parsed.surfaces.length === 1 ? "is" : "are"} already clear.`;
  } else {
    reply = `Cleared ${places}. That section is empty on the dashboard and will drop off Morning Brief and Evening Wrap.`;
  }

  try {
    const { emitBrief, listOfficeTasks } = await import("./runtime");
    const briefs = refreshTodayBriefs(
      listOfficeTasks(),
      now,
      {
        hub: saved,
        username,
        timezone: saved.profile.timezone || DEFAULT_TZ,
      },
      specific ? [`Removed ${parsed.title}`] : [`Cleared ${places}`],
    );
    for (const brief of briefs) emitBrief(brief);
  } catch {
    /* office runtime may be cold; hub write still stands */
  }

  return {
    action: "clear",
    surfaces: parsed.surfaces,
    title: parsed.title,
    when: parsed.when,
    reply,
    cleared,
  };
}

function inferSurfaces(text: string, action: "add" | "clear" = "add"): PersonalSurface[] {
  const t = text.toLowerCase();
  if (action === "clear" && ALL_SECTIONS_RE.test(t)) {
    return ["calendar", "task", "habit", "goal", "reminder"];
  }
  const out = new Set<PersonalSurface>();
  if (/\b(calendar|calander|calender|agenda)\b/.test(t) || /\bon my (day|calendar|calander|calender)\b/.test(t)) {
    out.add("calendar");
  }
  if (/\b(tasks?|to-?dos?)\b/.test(t)) out.add("task");
  if (/\bhabits?\b/.test(t)) out.add("habit");
  if (/\bgoals?\b/.test(t)) out.add("goal");
  if (/\bremind(er|ers| me)\b/.test(t)) out.add("reminder");
  if (
    action === "add" &&
    /\b(appointment|meeting|block|event)\b/.test(t) &&
    !out.has("habit") &&
    !out.has("goal") &&
    !out.has("reminder")
  ) {
    out.add("calendar");
  }
  if (out.size === 0 && action === "add") {
    out.add("calendar");
    out.add("task");
  }
  if (action === "add" && out.has("calendar") && /\b(task|to-?do)\b/.test(t)) out.add("task");
  const dated =
    DATE_RE.test(t) || hasMonthDay(t) || /\bon the \d{1,2}(st|nd|rd|th)?\b/.test(t);
  if (action === "add" && out.has("task") && dated && !out.has("habit") && !out.has("goal")) out.add("calendar");
  return [...out];
}

function parseTimeOfDay(text: string): { hour: number; minute: number } | null {
  const t = text.toLowerCase();
  if (/\bmidnight\b/.test(t)) return { hour: 0, minute: 0 };
  if (/\bnoon\b/.test(t) || /\bmidday\b/.test(t)) return { hour: 12, minute: 0 };
  const clock = t.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))\s*(a\.?m\.?|p\.?m\.?)?\b/);
  const ampmOnly = t.match(/\b(?:at\s+)?(\d{1,2})\s*(a\.?m\.?|p\.?m\.?)\b/);
  const oclock = t.match(/\b(?:at\s+)?(\d{1,2})\s*o'?clock\b/);
  const atBare = t.match(/\bat\s+(\d{1,2})\b/);
  const m = clock || ampmOnly || oclock || atBare;
  if (m) {
    let hour = Number(m[1]);
    const minute = m[2] && /^\d{2}$/.test(m[2]) ? Number(m[2]) : 0;
    const mer = ((m[2] && /[ap]/i.test(m[2]) ? m[2] : m[3]) || "").replace(/\./g, "").toLowerCase();
    if (mer.startsWith("p") && hour < 12) hour += 12;
    if (mer.startsWith("a") && hour === 12) hour = 0;
    if (!mer && hour >= 1 && hour <= 7) hour += 12;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return { hour, minute };
  }
  if (/\btonight\b/.test(t) || /\bevening\b/.test(t) || /\bat night\b/.test(t)) return { hour: 18, minute: 0 };
  if (/\bafternoon\b/.test(t)) return { hour: 14, minute: 0 };
  if (/\bmorning\b/.test(t)) return { hour: 9, minute: 0 };
  return null;
}

function defaultHour(text: string, surfaces: PersonalSurface[]): number {
  if (surfaces.includes("habit")) {
    const block = inferHabitBlock(text, 9);
    if (block === "evening") return 18;
    if (block === "afternoon") return 14;
    return 7;
  }
  return 9;
}

function parseDay(text: string, tz: string, now: number): { year: number; month: number; day: number } {
  const t = text.toLowerCase();
  const today = partsInZone(tz, now);
  if (/\btomorrow\b/.test(t)) return shiftYmd(today, 1);
  if (/\btoday\b/.test(t) || /\btonight\b/.test(t)) return { year: today.year, month: today.month, day: today.day };

  const monthDay = t.match(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/,
  );
  const dayMonth = t.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\b/,
  );
  if (monthDay || dayMonth) {
    const monthName = (monthDay ? monthDay[1] : dayMonth![2]).toLowerCase();
    const dayNum = Number(monthDay ? monthDay[2] : dayMonth![1]);
    const month = MONTHS[monthName];
    if (month && dayNum >= 1 && dayNum <= 31) {
      let year = today.year;
      const candidate = zonedWallToUtc(tz, year, month, dayNum, 23, 59);
      if (candidate < now) year += 1;
      return { year, month, day: dayNum };
    }
  }

  const onThe = t.match(/\bon the (\d{1,2})(?:st|nd|rd|th)?\b/);
  if (onThe) {
    const dayNum = Number(onThe[1]);
    let year = today.year;
    let month = today.month;
    if (dayNum < today.day) {
      const n = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
      year = n.year;
      month = n.month;
    }
    return { year, month, day: dayNum };
  }

  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return { year: Number(iso[1]), month: Number(iso[2]), day: Number(iso[3]) };

  const nextWeek = /\bnext week\b/.test(t);
  const thisWeek = /\bthis week\b/.test(t);
  for (const [name, dow] of Object.entries(WEEKDAYS)) {
    if (!new RegExp(`\\b${name}\\b`).test(t)) continue;
    const mode = /\bnext\b/.test(t) && !thisWeek ? "next" : nextWeek ? "next" : "auto";
    return weekdayYmd(tz, now, dow, mode);
  }
  if (nextWeek) return shiftYmd(today, 7);
  return { year: today.year, month: today.month, day: today.day };
}

function weekdayYmd(
  tz: string,
  now: number,
  dow: number,
  mode: "auto" | "next",
): { year: number; month: number; day: number } {
  const today = partsInZone(tz, now);
  let delta = (dow - today.weekday + 7) % 7;
  if (mode === "next" && delta === 0) delta = 7;
  const shifted = shiftYmd(today, delta);
  return shifted;
}

function shiftYmd(
  p: { year: number; month: number; day: number },
  days: number,
): { year: number; month: number; day: number } {
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day + days));
  return { year: dt.getUTCFullYear(), month: dt.getUTCMonth() + 1, day: dt.getUTCDate() };
}

function addMinutes(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  add: number,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const dt = new Date(Date.UTC(year, month - 1, day, hour, minute + add));
  return {
    year: dt.getUTCFullYear(),
    month: dt.getUTCMonth() + 1,
    day: dt.getUTCDate(),
    hour: dt.getUTCHours(),
    minute: dt.getUTCMinutes(),
  };
}

function extractTitle(text: string): string {
  let t = text.trim();
  t = t.replace(/^(please |can you |could you |would you |jarvis[, ]+|hey jarvis[, ]+)/i, "");
  t = t.replace(/\b(clear|cleared|delete|remove|wipe|empty|reset|drop|get rid of)\b/gi, " ");
  t = t.replace(/\b(all of|all my|all the|all|everything|every section)\b/gi, " ");
  t = t.replace(/\b(the )?(whole )?(board|deck|dashboard|hub)\b/gi, " ");
  t = t.replace(/\bfrom\b/gi, " ");
  t = t.replace(/\b(add|put|set|create|update|log|track|schedule|book|move|remember|remind me to|remind me|pencil|write)\b/gi, " ");
  t = t.replace(/\b(calendar|calander|calender|agenda|tasks?|to-?dos?|habits?|goals?|reminders?)\b/gi, " ");
  t = t.replace(/\b(with a|onto|into|on my|to my|for me|on the)\b/gi, " ");
  t = t.replace(/\b(today|tonight|tomorrow|this week|next week)\b/gi, " ");
  t = t.replace(
    /\b(next |this )?(monday|mon|tuesday|tue|tues|wednesday|wed|thursday|thu|thur|thurs|friday|fri|saturday|sat|sunday|sun)\b/gi,
    " ",
  );
  t = t.replace(
    /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+\d{1,2}(?:st|nd|rd|th)?\b/gi,
    " ",
  );
  t = t.replace(/\bon the \d{1,2}(?:st|nd|rd|th)?\b/gi, " ");
  t = t.replace(/\b(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:a\.?m\.?|p\.?m\.?|o'?clock)?\b/gi, " ");
  t = t.replace(/\b(in the )?(morning|afternoon|evening|night|noon|midnight|midday)\b/gi, " ");
  t = t.replace(/\b(an?|the|my|our|to|for|with|on|at|in)\b/gi, " ");
  t = t.replace(/[?.!,]+/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  if (!t || t.length < 2) return "Personal item";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function inferHabitBlock(text: string, hour: number): JarvisHabit["block"] {
  const t = text.toLowerCase();
  if (/\bevening\b/.test(t) || /\bnight\b/.test(t) || hour >= 17) return "evening";
  if (/\bafternoon\b/.test(t) || (hour >= 12 && hour < 17)) return "afternoon";
  return "morning";
}

function inferGoalCategory(text: string): string {
  const t = text.toLowerCase();
  if (/\b(health|gym|fitness|workout|weight|sleep)\b/.test(t)) return "Health";
  if (/\b(creator|newsletter|audience|subscribers?)\b/.test(t)) return "Creator";
  return "Founder";
}

function hasMonthDay(t: string): boolean {
  return /\b(january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)\s+\d{1,2}/.test(
    t,
  );
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isSpecificTitle(title: string): boolean {
  const n = normalizeTitle(title);
  return Boolean(n) && !GENERIC_TITLES.has(n);
}

function titleMatch(stored: string, asked: string): boolean {
  const a = normalizeTitle(stored);
  const b = normalizeTitle(asked);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

function alreadyHasEvent(events: JarvisEvent[], event: JarvisEvent, tz: string): boolean {
  return events.some(
    (e) => normalizeTitle(e.title) === normalizeTitle(event.title) && isSameDayInZone(e.start, event.start, tz),
  );
}

function alreadyHasTask(tasks: JarvisTask[], task: JarvisTask, tz: string): boolean {
  return tasks.some(
    (t) => normalizeTitle(t.title) === normalizeTitle(task.title) && isSameDayInZone(t.due, task.due, tz),
  );
}

function alreadyHasReminder(reminders: JarvisReminder[], reminder: JarvisReminder, tz: string): boolean {
  return reminders.some(
    (r) => normalizeTitle(r.title) === normalizeTitle(reminder.title) && isSameDayInZone(r.when, reminder.when, tz),
  );
}

function confirmReply(applied: AppliedPersonalUpdate, tz: string): string {
  const when = `${formatWeekdayInZone(applied.when, tz)} at ${formatClockInZone(applied.when, tz)}`;
  const labels: Record<PersonalSurface, string> = {
    calendar: "Calendar",
    task: "Tasks",
    habit: "Habits",
    goal: "Goals",
    reminder: "Reminders",
  };
  const places = applied.surfaces.map((s) => labels[s]).join(" and ");
  if (applied.surfaces.length === 1 && applied.surfaces[0] === "habit") {
    return `Logged ${applied.title} under Habits. Morning Brief and Evening Wrap will include it.`;
  }
  if (applied.surfaces.length === 1 && applied.surfaces[0] === "goal") {
    return `Set the goal ${applied.title} on Goals. It will show on Morning Brief and Evening Wrap.`;
  }
  return `Done. ${applied.title} is on ${when} — ${places}. Morning Brief and Evening Wrap will include it.`;
}

export function commandDateKey(when: number, tz: string): string {
  return dateKeyInZone(tz, when);
}

export function commandShiftDays(when: number, tz: string, days: number): number {
  return addDaysInZone(tz, when, days);
}
