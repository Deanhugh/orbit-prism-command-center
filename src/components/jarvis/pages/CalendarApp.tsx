"use client";

import { useMemo } from "react";
import { useJarvisHub } from "../useJarvisHub";
import { formatClockHM, seedEvents, startOfDay, type JarvisEvent } from "@/lib/jarvis-data";

export function CalendarApp() {
  const { hub } = useJarvisHub();
  const events = useMemo(
    () => [...seedEvents(), ...(hub?.extraEvents ?? [])].sort((a, b) => a.start - b.start),
    [hub?.extraEvents],
  );
  const horizon = startOfDay(Date.now()) + 14 * 86400000;
  const upcoming = events.filter((e) => e.start < horizon);
  const groups = groupByDay(upcoming);

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <p className="hud-label">Unified calendar</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <h1 className="serif text-[32px] font-bold">Next 14 days</h1>
        <p className="text-[11px] text-ink-soft">
          Last synced {new Date().toLocaleString("en-US", { month: "numeric", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}
        </p>
      </div>
      <div className="mt-8 space-y-7">
        {groups.map(([label, items]) => (
          <section key={label}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-soft">{label}</p>
            <ul className="mt-3 space-y-2">
              {items.map((e) => (
                <li key={e.id} className="hud-panel flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[14px]">{e.title}</p>
                    <p className="mt-1 text-[11px] text-ink-soft">
                      {formatClockHM(e.start)} – {formatClockHM(e.end)}
                      {e.location ? ` · ${e.location}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-ink-soft">
                    {e.calendar}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function groupByDay(events: JarvisEvent[]): [string, JarvisEvent[]][] {
  const map = new Map<string, JarvisEvent[]>();
  for (const e of events) {
    const key = new Date(e.start).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }).toUpperCase();
    map.set(key, [...(map.get(key) || []), e]);
  }
  return [...map.entries()];
}
