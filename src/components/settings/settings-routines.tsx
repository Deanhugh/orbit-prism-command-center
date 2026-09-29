"use client";

import { useEffect, useMemo, useState } from "react";
import { AlarmClock, Pause, Play, Plus, RefreshCw } from "lucide-react";
import type { BriefKind, Routine } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/office-data";
import { cn } from "@/lib/utils";

function clockValue(r: Routine): string {
  const h = r.hour ?? 8;
  const m = r.minute ?? 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function nextLabel(ts: number) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function Routines() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState("");
  const [custom, setCustom] = useState({
    title: "",
    cadence: "every weekday at 9am",
    dept: "ops",
    kind: "task" as "task" | "brief",
  });

  const load = () =>
    fetch("/api/routines")
      .then((r) => r.json())
      .then((d) => setRoutines(d.routines || []));

  useEffect(() => {
    load();
  }, []);

  const briefs = useMemo(() => routines.filter((r) => r.kind === "brief"), [routines]);
  const tasks = useMemo(() => routines.filter((r) => r.kind !== "brief"), [routines]);

  async function act(id: string, action: "pause" | "resume" | "run" | "delete") {
    setBusy(`${action}-${id}`);
    setMsg("");
    try {
      const res = await fetch("/api/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const d = await res.json();
      if (d.routines) setRoutines(d.routines);
      if (action === "run") setMsg("Running now. The Dashboard briefing will refresh when it lands.");
    } catch {
      setMsg("Could not update that routine.");
    } finally {
      setBusy("");
    }
  }

  async function saveTime(r: Routine, value: string) {
    const [hs, ms] = value.split(":");
    const hour = Number(hs);
    const minute = Number(ms);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return;
    setBusy(`time-${r.id}`);
    try {
      const res = await fetch("/api/routines", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, hour, minute }),
      });
      const d = await res.json();
      if (d.routines) setRoutines(d.routines);
    } finally {
      setBusy("");
    }
  }

  async function addCustom() {
    if (!custom.title.trim() || !custom.cadence.trim()) return;
    setBusy("add");
    setMsg("");
    try {
      const res = await fetch("/api/routines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: custom.title.trim(),
          cadence: custom.cadence.trim(),
          dept: custom.dept,
          kind: custom.kind,
          briefKind: custom.kind === "brief"
            ? (custom.title.toLowerCase().includes("evening") ? "evening" : "morning")
            : undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        setMsg(d.error || "Could not read that schedule.");
        return;
      }
      setCustom({ title: "", cadence: "every weekday at 9am", dept: "ops", kind: "task" });
      await load();
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="hud-label">Routines</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
          Scheduled loops, the same idea as Claude Cowork or ChatGPT scheduled tasks. Morning Brief
          and Evening Wrap write a dated update onto the Command Center Dashboard. Office loops
          assign desk work. Times follow the timezone on your profile.
        </p>
      </div>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Dashboard loops</p>
        {briefs.length === 0 ? (
          <p className="text-[13px] text-ink-soft">No briefing loops yet.</p>
        ) : (
          briefs.map((r) => (
            <RoutineCard
              key={r.id}
              r={r}
              busy={busy}
              onAct={act}
              onTime={saveTime}
              kindLabel={briefLabel(r.briefKind)}
            />
          ))
        )}
      </section>

      <section className="space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">Office loops</p>
        <p className="text-[12px] text-ink-soft">
          Inbox triage, invoice chase, and competitor scan default to paused. Turn one on when you
          want that desk job on a clock.
        </p>
        {tasks.map((r) => (
          <RoutineCard
            key={r.id}
            r={r}
            busy={busy}
            onAct={act}
            onTime={saveTime}
            kindLabel={DEPARTMENTS.find((d) => d.id === r.dept)?.name || r.dept}
          />
        ))}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 space-y-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
          Add a routine
        </p>
        <label className="block">
          <span className="hud-label">Title</span>
          <input
            value={custom.title}
            onChange={(e) => setCustom({ ...custom, title: e.target.value })}
            placeholder="Weekly pipeline review"
            className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
          />
        </label>
        <label className="block">
          <span className="hud-label">When</span>
          <input
            value={custom.cadence}
            onChange={(e) => setCustom({ ...custom, cadence: e.target.value })}
            placeholder="every weekday at 9am"
            className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <label className="block min-w-[140px] flex-1">
            <span className="hud-label">Kind</span>
            <select
              value={custom.kind}
              onChange={(e) => setCustom({ ...custom, kind: e.target.value as "task" | "brief" })}
              className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
            >
              <option value="task">Office task</option>
              <option value="brief">Dashboard brief</option>
            </select>
          </label>
          <label className="block min-w-[140px] flex-1">
            <span className="hud-label">Department</span>
            <select
              value={custom.dept}
              onChange={(e) => setCustom({ ...custom, dept: e.target.value })}
              className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={addCustom}
          disabled={busy === "add"}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-50"
        >
          <Plus size={12} />
          {busy === "add" ? "Adding…" : "Add routine"}
        </button>
      </section>

      {msg ? <p className="text-[13px] text-ink-soft">{msg}</p> : null}
    </div>
  );
}

function briefLabel(kind?: BriefKind) {
  if (kind === "evening") return "Evening wrap";
  return "Morning brief";
}

function RoutineCard({
  r,
  busy,
  onAct,
  onTime,
  kindLabel,
}: {
  r: Routine;
  busy: string;
  onAct: (id: string, action: "pause" | "resume" | "run" | "delete") => void;
  onTime: (r: Routine, value: string) => void;
  kindLabel: string;
}) {
  const on = !r.paused;
  return (
    <div className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[14px] font-semibold text-ink">{r.title}</p>
            <span className="rounded-full bg-ops/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ops">
              {kindLabel}
            </span>
          </div>
          <p className="mt-1 text-[12px] text-ink-soft">
            {r.cadence}
            {r.timezone ? ` · ${r.timezone}` : ""}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wide text-ink-soft">
            {on ? `Next ${nextLabel(r.nextRun)}` : "Paused"}
            {r.lastRun ? ` · last ${nextLabel(r.lastRun)}` : ""}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onAct(r.id, on ? "pause" : "resume")}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            on ? "bg-emails" : "bg-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform",
              on ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-2 text-[12px] text-ink-soft">
          <AlarmClock size={12} />
          <input
            type="time"
            value={clockValue(r)}
            onChange={(e) => onTime(r, e.target.value)}
            className="rounded-full border border-line bg-canvas-2 px-3 py-1 text-[12px] text-ink outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => onAct(r.id, "run")}
          disabled={busy.startsWith("run")}
          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={10} />
          Run now
        </button>
        {on ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-emails">
            <Play size={10} /> On
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-ink-soft">
            <Pause size={10} /> Off
          </span>
        )}
        <button
          type="button"
          onClick={() => onAct(r.id, "delete")}
          className="ml-auto text-[10px] font-bold uppercase tracking-wide text-marketing"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
