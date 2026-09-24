import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { emptyHub, type JarvisHub } from "../jarvis-data";

function hubPath(userId: string) {
  return path.join(dataDir(), `jarvis-${userId}.json`);
}

export function readHub(userId: string, username: string): JarvisHub {
  const fallback = emptyHub(username);
  try {
    const raw = JSON.parse(fs.readFileSync(hubPath(userId), "utf8")) as Partial<JarvisHub>;
    return {
      profile: { ...fallback.profile, ...raw.profile },
      habitsDone: Array.isArray(raw.habitsDone) ? raw.habitsDone : fallback.habitsDone,
      articles: Array.isArray(raw.articles) ? raw.articles : fallback.articles,
      notes: Array.isArray(raw.notes) ? raw.notes : fallback.notes,
      proposals: Array.isArray(raw.proposals) ? raw.proposals : fallback.proposals,
      extraEvents: Array.isArray(raw.extraEvents) ? raw.extraEvents : fallback.extraEvents,
      goals: Array.isArray(raw.goals) ? raw.goals : fallback.goals,
      reminders: Array.isArray(raw.reminders) ? raw.reminders : fallback.reminders,
      replies: Array.isArray(raw.replies) ? raw.replies : fallback.replies,
      projects: Array.isArray(raw.projects) ? raw.projects : fallback.projects,
      appearance: raw.appearance
        ? { ...fallback.appearance, ...raw.appearance, colors: raw.appearance.colors || {} }
        : fallback.appearance,
      crm: {
        labels: Array.isArray(raw.crm?.labels) ? raw.crm.labels : fallback.crm.labels,
        categories: Array.isArray(raw.crm?.categories) ? raw.crm.categories : fallback.crm.categories,
        statuses: Array.isArray(raw.crm?.statuses) ? raw.crm.statuses : fallback.crm.statuses,
      },
      greetings: Array.isArray(raw.greetings) ? raw.greetings : fallback.greetings,
    };
  } catch {
    writeHub(userId, fallback);
    return fallback;
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
    goals: patch.goals ?? current.goals,
    reminders: patch.reminders ?? current.reminders,
    replies: patch.replies ?? current.replies,
    projects: patch.projects ?? current.projects,
    appearance: patch.appearance
      ? { ...current.appearance, ...patch.appearance, colors: patch.appearance.colors ?? current.appearance.colors }
      : current.appearance,
    crm: patch.crm ?? current.crm,
    greetings: patch.greetings ?? current.greetings,
  };
  return writeHub(userId, next);
}
