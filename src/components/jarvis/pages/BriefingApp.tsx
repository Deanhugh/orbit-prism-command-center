"use client";

import { useEffect, useMemo, useState } from "react";
import { useJarvisHub } from "../useJarvisHub";
import { greetingWord } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { useOffice } from "@/lib/store";
import type { BriefKind, StoredBrief } from "@/lib/types";
import { BriefBody } from "../BriefBody";
import { primeJarvisSpeech, speakJarvis, spokenBrief } from "@/lib/speak-jarvis";

const TABS = ["Morning", "Evening", "History"] as const;

export function BriefingApp({ username }: { username: string }) {
  useOrbitInit();
  const { hub } = useJarvisHub();
  const streamed = useOffice((s) => s.briefs);
  const [stored, setStored] = useState<StoredBrief[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Morning");
  const [running, setRunning] = useState(false);
  const owner = hub?.profile.ownerName || (username.startsWith("guest-") ? "there" : username);

  useEffect(() => {
    fetch("/api/briefs")
      .then((r) => r.json())
      .then((d) => setStored(d.briefs || []))
      .catch(() => {});
  }, []);

  const briefs = streamed.length ? streamed : stored;
  const kind: BriefKind = tab === "Evening" ? "evening" : "morning";
  const current = useMemo(
    () =>
      [...briefs]
        .filter((b) => b.kind === kind)
        .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))[0] || null,
    [briefs, kind],
  );
  const history = useMemo(() => briefs.slice(0, 20), [briefs]);

  async function runNow() {
    if (tab === "History") return;
    setRunning(true);
    primeJarvisSpeech();
    try {
      const res = await fetch("/api/briefs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind }),
      });
      const d = await res.json();
      if (d.briefs) setStored(d.briefs);
      const written = (d.briefs as StoredBrief[] | undefined)?.find((b) => b.kind === kind);
      if (written) speakJarvis(spokenBrief(written));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap gap-4">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                if (t === "History") return;
                const kind: BriefKind = t === "Evening" ? "evening" : "morning";
                const brief =
                  [...briefs]
                    .filter((b) => b.kind === kind)
                    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))[0];
                primeJarvisSpeech();
                speakJarvis(
                  brief
                    ? spokenBrief(brief)
                    : `No ${kind === "evening" ? "evening wrap" : "morning brief"} stored yet.`,
                );
              }}
              className={cn(
                "text-[12px] font-semibold uppercase tracking-[0.14em]",
                tab === t ? "text-ink" : "text-ink-soft hover:text-ink",
              )}
            >
              {t}
            </button>
          ))}
        </div>
        {tab !== "History" ? (
          <button
            type="button"
            onClick={runNow}
            disabled={running}
            className="rounded-full border border-line px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-50"
          >
            {running ? "Writing…" : "Write now"}
          </button>
        ) : null}
      </div>
      <p className="mt-6 text-[11px] uppercase tracking-[0.16em] text-ink-soft">
        {current
          ? new Date(current.createdAt).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })
          : new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>
      <h1 className="serif mt-3 text-[32px] font-bold">
        {tab === "Evening" ? "Evening wrap" : tab === "History" ? "Recent briefs" : "Morning brief"}
      </h1>
      <p className="mt-2 text-[15px] text-ink-soft">
        {current?.greeting || `Good ${tab === "Evening" ? "evening" : greetingWord()}, ${owner}.`}
      </p>

      {tab === "History" ? (
        history.length === 0 ? (
          <p className="mt-8 text-[14px] text-ink-soft">
            No briefs stored yet. Turn on Morning Brief or Evening Wrap in Settings → Routines, or write one now.
          </p>
        ) : (
          <ul className="mt-8 space-y-5">
            {history.map((b) => (
              <li key={b.id} className="border-b border-line pb-4">
                <p className="text-[11px] uppercase tracking-[0.14em] text-ink-soft">
                  {b.kind === "evening" ? "Evening wrap" : "Morning brief"} · {b.date}
                </p>
                <p className="mt-2 text-[14px] leading-relaxed text-ink">{b.narrative}</p>
              </li>
            ))}
          </ul>
        )
      ) : current ? (
        <div className="mt-8">
          <BriefBody brief={current} />
          {current.notePath ? (
            <p className="mt-8 text-[11px] uppercase tracking-wide text-ink-soft">
              Filed to Brain: {current.notePath}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-8 text-[14px] text-ink-soft">
          No {tab === "Evening" ? "evening wrap" : "morning brief"} stored yet. Settings → Routines
          schedules them, or write one now from this page.
        </p>
      )}
    </div>
  );
}
