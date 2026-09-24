"use client";

import { useState } from "react";
import { useJarvisHub } from "../useJarvisHub";
import { greetingWord, seedEvents, seedTasks, isSameDay, formatClockHM } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";

const TABS = ["Morning", "Evening", "History"] as const;

export function BriefingApp({ username }: { username: string }) {
  const { hub } = useJarvisHub();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Morning");
  const owner = hub?.profile.ownerName || (username.startsWith("guest-") ? "there" : username);
  const now = Date.now();
  const todayEvents = seedEvents().filter((e) => isSameDay(e.start, now));
  const overdue = seedTasks().filter((t) => t.due < now && t.status !== "done");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap gap-4 border-b border-line pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "text-[12px] font-semibold uppercase tracking-[0.14em]",
              tab === t ? "text-ink" : "text-ink-soft hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1 className="serif mt-3 text-[32px] font-bold">
        {tab === "Evening" ? "Evening wrap" : tab === "History" ? "Recent briefs" : "Morning brief"}
      </h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        Good {tab === "Evening" ? "evening" : greetingWord()}, {owner}.
      </p>

      {tab === "History" ? (
        <ul className="mt-8 space-y-4 text-[14px] text-ink-soft">
          <li>Yesterday — 4 tasks closed. Harbourside renewal opened.</li>
          <li>Two days ago — homepage v1 review filed. Wei chose the quieter lockup.</li>
          <li>Last week — Lumen Health kickoff. Vault folder created.</li>
        </ul>
      ) : (
        <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
          <section>
            <h2 className="serif text-[18px] font-bold">Today</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <span className="font-semibold">{overdue.length} overdue</span> if we count the Loop Health invoice — chase it first.
              </li>
              {todayEvents.map((e) => (
                <li key={e.id}>
                  {formatClockHM(e.start)}: {e.title}.
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="serif text-[18px] font-bold">Waiting on you</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Wei Chen’s homepage mockups need sign-off before Friday.</li>
              <li>Elena Ruiz’s onboarding checklist is ready for approval.</li>
            </ul>
          </section>
          <section>
            <h2 className="serif text-[18px] font-bold">Waiting on them</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Loop Health: Q3 invoice, nudged four days ago.</li>
              <li>Harbourside: testimonial, second ask last week.</li>
            </ul>
          </section>
          <section>
            <h2 className="serif text-[18px] font-bold">Tomorrow</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>10:00 AM status call with Amara. Prep note is pinned in Notepad — push the biweekly update, raise the renewal early.</li>
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}
