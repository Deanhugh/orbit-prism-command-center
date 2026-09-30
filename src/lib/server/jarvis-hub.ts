import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import {
  DASHBOARD_BLANK_GEN,
  blankDashboardLists,
  emptyHub,
  type JarvisHub,
} from "../jarvis-data";

function hubPath(userId: string) {
  return path.join(dataDir(), `jarvis-${userId}.json`);
}

function assembleHub(username: string, raw: Partial<JarvisHub>): JarvisHub {
  const fallback = emptyHub(username);
  return {
    profile: { ...fallback.profile, ...raw.profile },
    habitsDone: Array.isArray(raw.habitsDone) ? raw.habitsDone : fallback.habitsDone,
    articles: Array.isArray(raw.articles) ? raw.articles : fallback.articles,
    notes: Array.isArray(raw.notes) ? raw.notes : fallback.notes,
    proposals: Array.isArray(raw.proposals) ? raw.proposals : fallback.proposals,
    extraEvents: Array.isArray(raw.extraEvents) ? raw.extraEvents : fallback.extraEvents,
    extraTasks: Array.isArray(raw.extraTasks) ? raw.extraTasks : fallback.extraTasks,
    extraHabits: Array.isArray(raw.extraHabits) ? raw.extraHabits : fallback.extraHabits,
    goals: Array.isArray(raw.goals) ? raw.goals : fallback.goals,
    reminders: Array.isArray(raw.reminders) ? raw.reminders : fallback.reminders,
    replies: Array.isArray(raw.replies) ? raw.replies : fallback.replies,
    projects: Array.isArray(raw.projects) ? raw.projects : fallback.projects,
    meetings: Array.isArray(raw.meetings) ? raw.meetings : fallback.meetings,
    appearance: raw.appearance
      ? { ...fallback.appearance, ...raw.appearance, colors: raw.appearance.colors || {} }
      : fallback.appearance,
    crm: {
      labels: Array.isArray(raw.crm?.labels) ? raw.crm.labels : fallback.crm.labels,
      categories: Array.isArray(raw.crm?.categories) ? raw.crm.categories : fallback.crm.categories,
      statuses: Array.isArray(raw.crm?.statuses) ? raw.crm.statuses : fallback.crm.statuses,
    },
    greetings: Array.isArray(raw.greetings) ? raw.greetings : fallback.greetings,
    suppressSeeds: {
      calendar: raw.suppressSeeds?.calendar ?? fallback.suppressSeeds.calendar,
      habits: raw.suppressSeeds?.habits ?? fallback.suppressSeeds.habits,
    },
    dashboardBlankGen: typeof raw.dashboardBlankGen === "number" ? raw.dashboardBlankGen : 0,
  };
}

export function readHub(userId: string, username: string): JarvisHub {
  try {
    const raw = JSON.parse(fs.readFileSync(hubPath(userId), "utf8")) as Partial<JarvisHub>;
    const hub = assembleHub(username, raw);
    if ((hub.dashboardBlankGen ?? 0) < DASHBOARD_BLANK_GEN) {
      const next = writeHub(userId, { ...hub, ...blankDashboardLists() });
      void refreshBriefsAfterBlank(next, username);
      return next;
    }
    return hub;
  } catch {
    const fallback = emptyHub(username);
    writeHub(userId, fallback);
    return fallback;
  }
}

async function refreshBriefsAfterBlank(hub: JarvisHub, username: string) {
  try {
    const { clearMorningBriefForToday, refreshTodayBriefs } = await import("./briefs");
    const { emitBrief, listOfficeTasks } = await import("./runtime");
    emitBrief(clearMorningBriefForToday());
    const briefs = refreshTodayBriefs(
      listOfficeTasks(),
      Date.now(),
      { hub, username, timezone: hub.profile.timezone || "America/New_York" },
      ["Cleared dashboard"],
    );
    for (const brief of briefs) emitBrief(brief);
  } catch {
    /* briefs refresh is best-effort after a wipe */
  }
}

export function writeHub(userId: string, hub: JarvisHub): JarvisHub {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(hubPath(userId), JSON.stringify(hub, null, 2));
  return hub;
}

export function patchHub(userId: string, username: string, patch: Partial<JarvisHub>): JarvisHub {
  const current = readHub(userId, username);
  const next: JarvisHub = {
    profile: { ...current.profile, ...patch.profile },
    habitsDone: patch.habitsDone ?? current.habitsDone,
    articles: patch.articles ?? current.articles,
    notes: patch.notes ?? current.notes,
    proposals: patch.proposals ?? current.proposals,
    extraEvents: patch.extraEvents ?? current.extraEvents,
    extraTasks: patch.extraTasks ?? current.extraTasks,
    extraHabits: patch.extraHabits ?? current.extraHabits,
    goals: patch.goals ?? current.goals,
    reminders: patch.reminders ?? current.reminders,
    replies: patch.replies ?? current.replies,
    projects: patch.projects ?? current.projects,
    meetings: patch.meetings ?? current.meetings,
    appearance: patch.appearance
      ? { ...current.appearance, ...patch.appearance, colors: patch.appearance.colors ?? current.appearance.colors }
      : current.appearance,
    crm: patch.crm ?? current.crm,
    greetings: patch.greetings ?? current.greetings,
    suppressSeeds: {
      calendar: patch.suppressSeeds?.calendar ?? current.suppressSeeds?.calendar,
      habits: patch.suppressSeeds?.habits ?? current.suppressSeeds?.habits,
    },
    dashboardBlankGen: patch.dashboardBlankGen ?? current.dashboardBlankGen ?? DASHBOARD_BLANK_GEN,
  };
  return writeHub(userId, next);
}
