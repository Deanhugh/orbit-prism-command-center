"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, RefreshCw } from "lucide-react";
import { useOffice } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  dayProgress,
  formatClockHM,
  greetingWord,
  pickGreeting,
  isSameDay,
  seedEvents,
  seedHabits,
  seedTasks,
  startOfDay,
  type JarvisEvent,
  type JarvisTask,
} from "@/lib/jarvis-data";
import type { JarvisHub } from "@/lib/jarvis-data";
import { useJarvisHub } from "./useJarvisHub";
import { DeckFollowups } from "./DeckFollowups";
import { DeckWork } from "./DeckWork";
import { DeckKnowledge } from "./DeckKnowledge";

type TaskTab = "today" | "overdue" | "upcoming" | "all";

export function JarvisDashboard({
  username,
  initialHub,
}: {
  username: string;
  initialHub?: JarvisHub | null;
}) {
  const { hub, save } = useJarvisHub(initialHub, username);
  const officeTasks = useOffice((s) => s.tasks);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<TaskTab>("today");
  const [briefTab, setBriefTab] = useState<"morning" | "evening">("morning");

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const owner = hub?.profile.ownerName || prettyName(username);
  const greet = greetingWord(new Date(now));
  const progress = dayProgress(new Date(now));

  const tasks = useMemo(() => mergeTasks(officeTasks, seedTasks()), [officeTasks]);
  const events = useMemo(
    () => [...seedEvents(), ...(hub?.extraEvents ?? [])].sort((a, b) => a.start - b.start),
    [hub?.extraEvents],
  );
  const habits = seedHabits();
  const done = new Set(hub?.habitsDone ?? []);

  const filtered = tasks.filter((t) => {
    if (tab === "all") return t.status !== "done";
    if (tab === "today") return isSameDay(t.due, now) && t.status !== "done";
    if (tab === "overdue") return t.due < startOfDay(now) && t.status !== "done";
    return t.due > startOfDay(now) + 86400000 - 1 && t.status !== "done";
  });

  const dueToday = tasks.filter((t) => isSameDay(t.due, now) && t.status !== "done").length;
  const overdue = tasks.filter((t) => t.due < startOfDay(now) && t.status !== "done").length;
  const todayEvents = events.filter((e) => isSameDay(e.start, now));

  async function toggleHabit(id: string) {
    if (!hub) return;
    const next = done.has(id) ? hub.habitsDone.filter((x) => x !== id) : [...hub.habitsDone, id];
    await save({ habitsDone: next });
  }

  const jarvisLine =
    overdue > 0
      ? `${overdue} item${overdue === 1 ? "" : "s"} slipped. I have them at the top of the deck.`
      : dueToday > 0
        ? `${dueToday} on the board today. I will keep the desks moving.`
        : "All systems nominal. Nothing is waiting on you.";

  return (
    <div className="grid min-h-full w-full grid-cols-1 gap-3 p-3 sm:p-4 lg:grid-cols-12 lg:gap-3">
      <section className="hud-panel hud-glow relative min-h-[280px] overflow-hidden p-5 lg:col-span-5 lg:min-h-[340px]">
        <div className="hud-scan absolute inset-0 opacity-40" />
        <div className="relative">
          <p className="hud-label flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emails" />
            Today · Jarvis
          </p>
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
            Good {greet}
          </p>
          <p className="serif mt-8 text-[56px] font-semibold leading-none tabular-nums sm:text-[64px]">
            {formatClockHM(now)}
          </p>
          <p className="mt-4 text-[15px] text-ink">
            {pickGreeting(hub?.greetings ?? [], owner.split(" ")[0] || owner)}
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{jarvisLine}</p>
          <div className="mt-8">
            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">
              {new Date(now).toLocaleDateString("en-US", {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </p>
            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-cyan"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-3 lg:min-h-[340px]">
        <div className="flex items-center justify-between gap-2">
          <p className="hud-label">Tasks</p>
          <span className="text-[10px] text-ink-soft">
            {filtered.length}/{tasks.length}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {(["today", "overdue", "upcoming", "all"] as TaskTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                tab === t ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto thin-scroll pr-1">
          {filtered.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-ink-soft">Nothing in this view.</p>
          ) : (
            groupByProject(filtered).map(([project, items]) => (
              <div key={project}>
                <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-ink-soft">
                  <span>{project}</span>
                  <span>{avgProgress(items)}%</span>
                </div>
                <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-line">
                  <div className="h-full bg-cyan" style={{ width: `${avgProgress(items)}%` }} />
                </div>
                <ul className="mt-2 space-y-1.5">
                  {items.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2 text-[12px]">
                      <span className={cn("min-w-0", t.priority === "high" && "text-ink")}>{t.title}</span>
                      <span className="shrink-0 text-[10px] uppercase text-ink-soft">
                        {t.status.replace("_", " ")}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-4 lg:min-h-[340px]">
        <div className="flex items-center justify-between">
          <p className="hud-label">Calendar · Orbit</p>
          <Link href="/jarvis/calendar" className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">
            Open page
          </Link>
        </div>
        <ul className="mt-3 flex-1 space-y-3 overflow-y-auto thin-scroll">
          {groupEvents(events.slice(0, 8)).map(([day, items]) => (
            <li key={day}>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft">{day}</p>
              <ul className="mt-1.5 space-y-2">
                {items.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <section className="hud-panel p-4 lg:col-span-8">
        <div className="flex items-center justify-between gap-2">
          <p className="hud-label">Briefing</p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setBriefTab("morning")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                briefTab === "morning" ? "bg-ink text-canvas" : "text-ink-soft",
              )}
            >
              Morning
            </button>
            <button
              type="button"
              onClick={() => setBriefTab("evening")}
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase",
                briefTab === "evening" ? "bg-ink text-canvas" : "text-ink-soft",
              )}
            >
              Evening
            </button>
            <Link href="/jarvis/briefing" className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase text-ink-soft hover:text-ink">
              All briefings
            </Link>
          </div>
        </div>
        <h2 className="serif mt-4 text-[22px] font-bold">
          {briefTab === "morning" ? "Morning brief" : "Evening wrap"}
        </h2>
        <p className="mt-1 text-[13px] text-ink-soft">
          Good {briefTab === "morning" ? "morning" : "evening"}, {owner}.
        </p>
        <div className="mt-5 grid gap-6 sm:grid-cols-2">
          <div>
            <p className="hud-label">Today · Jarvis</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">{dueToday} on the board today.</span>
              {todayEvents[0] ? ` Next: ${formatClockHM(todayEvents[0].start)} ${todayEvents[0].title}.` : ""}
            </p>
          </div>
          <div>
            <p className="hud-label">Waiting on you</p>
            <ul className="mt-2 space-y-2 text-[13px] leading-relaxed">
              <li>Wei Chen’s homepage mockups need sign-off before the Friday deadline.</li>
              <li>Elena’s onboarding checklist is ready for approval.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="hud-panel p-4 lg:col-span-4">
        <div className="flex items-center justify-between">
          <p className="hud-label">Habits</p>
          <span className="text-[10px] text-ink-soft">
            {done.size}/{habits.length}
          </span>
        </div>
        <HabitBlock
          title="Morning routine"
          items={habits.filter((h) => h.block === "morning")}
          done={done}
          onToggle={toggleHabit}
        />
        <HabitBlock
          title="Afternoon routine"
          items={habits.filter((h) => h.block === "afternoon")}
          done={done}
          onToggle={toggleHabit}
        />
        <HabitBlock
          title="Evening routine"
          items={habits.filter((h) => h.block === "evening")}
          done={done}
          onToggle={toggleHabit}
        />
        <p className="mt-4 flex items-center gap-1 text-[10px] text-ink-soft">
          <RefreshCw size={10} />
          Jarvis logs these on this machine only.
        </p>
      </section>

      {hub ? <DeckFollowups hub={hub} save={save} /> : null}
      {hub ? <DeckWork hub={hub} save={save} /> : null}
      {hub ? <DeckKnowledge articles={hub.articles ?? []} /> : null}
    </div>
  );
}

function HabitBlock({
  title,
  items,
  done,
  onToggle,
}: {
  title: string;
  items: { id: string; title: string }[];
  done: Set<string>;
  onToggle: (id: string) => void;
}) {
  const complete = items.filter((i) => done.has(i.id)).length;
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]">{title}</p>
        <span className="text-[10px] text-ink-soft">
          {complete}/{items.length}
        </span>
      </div>
      <ul className="mt-2 space-y-1.5">
        {items.map((h) => {
          const on = done.has(h.id);
          return (
            <li key={h.id}>
              <button
                type="button"
                onClick={() => onToggle(h.id)}
                className="flex w-full items-center gap-2 text-left text-[13px]"
              >
                <span
                  className={cn(
                    "grid h-4 w-4 place-items-center rounded-full border",
                    on ? "border-emails bg-emails text-canvas" : "border-line",
                  )}
                >
                  {on ? <Check size={10} /> : null}
                </span>
                <span className={cn(on && "text-ink-soft line-through")}>{h.title}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function EventRow({ event }: { event: JarvisEvent }) {
  return (
    <div className="flex items-start justify-between gap-2 text-[12px]">
      <div className="min-w-0">
        <p className="truncate">{event.title}</p>
        <p className="text-[10px] text-ink-soft">
          {formatClockHM(event.start)}
          {event.with ? ` · ${event.with}` : ""}
        </p>
      </div>
    </div>
  );
}

function prettyName(username: string) {
  if (username.startsWith("guest-")) return "there";
  return username.charAt(0).toUpperCase() + username.slice(1);
}

function mergeTasks(
  office: { id: string; title: string; status: string; progress: number; updatedAt: number }[],
  seed: JarvisTask[],
): JarvisTask[] {
  const fromOffice: JarvisTask[] = office.slice(0, 8).map((t) => ({
    id: t.id,
    title: t.title,
    project: "Office",
    due: t.updatedAt || Date.now(),
    progress: t.progress,
    status: t.status === "done" ? "done" : t.status === "in_progress" ? "in_progress" : t.status === "waiting_approval" ? "waiting" : "todo",
    priority: "normal",
  }));
  const seen = new Set(fromOffice.map((t) => t.title.toLowerCase()));
  return [...fromOffice, ...seed.filter((t) => !seen.has(t.title.toLowerCase()))];
}

function groupByProject(tasks: JarvisTask[]): [string, JarvisTask[]][] {
  const map = new Map<string, JarvisTask[]>();
  for (const t of tasks) {
    const key = t.project || "No project";
    map.set(key, [...(map.get(key) || []), t]);
  }
  return [...map.entries()];
}

function avgProgress(items: JarvisTask[]) {
  if (!items.length) return 0;
  return Math.round(items.reduce((s, t) => s + t.progress, 0) / items.length);
}

function groupEvents(events: JarvisEvent[]): [string, JarvisEvent[]][] {
  const map = new Map<string, JarvisEvent[]>();
  for (const e of events) {
    const key = new Date(e.start).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    }).toUpperCase();
    map.set(key, [...(map.get(key) || []), e]);
  }
  return [...map.entries()];
}
