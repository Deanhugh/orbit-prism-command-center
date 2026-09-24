"use client";

import { useState } from "react";
import { useJarvisHub } from "../useJarvisHub";
import { formatWhen, type JarvisEvent, type JarvisProposal } from "@/lib/jarvis-data";
import { cn } from "@/lib/utils";

export function SchedulingApp() {
  const { hub, save } = useJarvisHub();
  const [tab, setTab] = useState<"pending" | "approved" | "history">("pending");
  const [busy, setBusy] = useState<string | null>(null);

  const proposals = hub?.proposals ?? [];
  const shown = proposals.filter((p) => {
    if (tab === "pending") return p.status === "pending";
    if (tab === "approved") return p.status === "approved";
    return p.status === "rejected";
  });

  async function decide(id: string, status: "approved" | "rejected", optionStart?: number) {
    if (!hub) return;
    setBusy(id);
    try {
      const next = hub.proposals.map((p) => (p.id === id ? { ...p, status } : p));
      let extraEvents = hub.extraEvents;
      if (status === "approved" && optionStart != null) {
        const p = hub.proposals.find((x) => x.id === id);
        if (p) {
          const ev: JarvisEvent = {
            id: `ev_${id}`,
            title: p.subject,
            start: optionStart,
            end: optionStart + p.minutes * 60_000,
            calendar: "Orbit",
            with: p.email,
            location: "Zoom",
          };
          extraEvents = [...hub.extraEvents.filter((e) => e.id !== ev.id), ev];
        }
      }
      await save({ proposals: next, extraEvents });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <p className="text-[13px] text-ink-soft">
        Approve high-confidence meeting requests before they hit the calendar.
      </p>
      <div className="mt-5 flex gap-4 border-b border-line pb-2 text-[12px] font-semibold uppercase tracking-wide">
        {(["pending", "approved", "history"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(tab === t ? "text-ink" : "text-ink-soft")}
          >
            {t} ({proposals.filter((p) => (t === "history" ? p.status === "rejected" : p.status === t)).length})
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-4">
        {shown.length === 0 ? (
          <p className="py-12 text-center text-[13px] text-ink-soft">Nothing in this queue.</p>
        ) : (
          shown.map((p) => (
            <ProposalCard key={p.id} p={p} busy={busy === p.id} onDecide={decide} />
          ))
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  p,
  busy,
  onDecide,
}: {
  p: JarvisProposal;
  busy: boolean;
  onDecide: (id: string, status: "approved" | "rejected", optionStart?: number) => void;
}) {
  const [pick, setPick] = useState(p.options[0]?.start);
  return (
    <article className="hud-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[16px] font-semibold">{p.name}</h2>
            <span className="rounded-full bg-finance/15 px-2 py-0.5 text-[10px] font-bold uppercase text-finance">
              {p.status}
            </span>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] uppercase text-ink-soft">
              {p.kind}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">{p.subject}</p>
        </div>
        <div className="text-right text-[11px] text-ink-soft">
          <p>{p.minutes} min</p>
          <p>{p.confidence}% confidence</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">{p.summary}</p>
      {p.status === "pending" ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {p.options.map((o) => (
              <button
                key={o.start}
                type="button"
                onClick={() => setPick(o.start)}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-[12px]",
                  pick === o.start ? "border-ink bg-canvas-2" : "border-line",
                )}
              >
                <p className="font-semibold uppercase tracking-wide text-ink-soft">Option</p>
                <p className="mt-1">{formatWhen(o.start)}</p>
                <p className="text-ink-soft">{o.channel}</p>
              </button>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-ink-soft">Reply to {p.email}</p>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(p.id, "rejected")}
              className="rounded-full border border-line px-3 py-1.5 text-[11px] font-bold uppercase disabled:opacity-50"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={busy || pick == null}
              onClick={() => onDecide(p.id, "approved", pick)}
              className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
            >
              Approve
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
