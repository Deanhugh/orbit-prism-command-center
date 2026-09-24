"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Check, Pin, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isSameDay,
  startOfDay,
  type JarvisGoal,
  type JarvisHub,
  type JarvisReminder,
  type JarvisReply,
} from "@/lib/jarvis-data";

export function DeckFollowups({
  hub,
  save,
}: {
  hub: JarvisHub;
  save: (patch: Partial<JarvisHub>) => Promise<unknown>;
}) {
  return (
    <>
      <GoalsCard goals={hub.goals ?? []} onChange={(goals) => save({ goals })} />
      <RemindersCard reminders={hub.reminders ?? []} onChange={(reminders) => save({ reminders })} />
      <RepliesCard replies={hub.replies ?? []} onChange={(replies) => save({ replies })} />
    </>
  );
}

function GoalsCard({
  goals,
  onChange,
}: {
  goals: JarvisGoal[];
  onChange: (next: JarvisGoal[]) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Founder");
  const [busy, setBusy] = useState(false);

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await onChange([
        ...goals,
        {
          id: `g_${Date.now().toString(36)}`,
          title: clean,
          category: category.trim() || "Founder",
          daysLeft: null,
          progress: 0,
        },
      ]);
      setTitle("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-4">
      <CardHead label="Goals" pin>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:bg-canvas-2 hover:text-ink"
        >
          <Plus size={12} />
          Add
        </button>
      </CardHead>
      <p className="mt-2 text-[11px] text-ink-soft">{goals.length} active</p>
      {open ? (
        <form onSubmit={add} className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New goal"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
          />
          <div className="flex gap-2">
            <input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Category"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-3 py-2 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </form>
      ) : null}
      <ul className="mt-4 flex-1 space-y-4">
        {goals.length === 0 ? (
          <li className="text-[13px] text-ink-soft">No goals on the deck yet.</li>
        ) : (
          goals.map((g) => (
            <li key={g.id}>
              <div className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink-soft" />
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] leading-snug">{g.title}</p>
                  <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-ink-soft">
                    <span>
                      {g.category}
                      {g.daysLeft != null ? ` · ${g.daysLeft} days` : ""}
                    </span>
                    <span>{g.progress}%</span>
                  </div>
                  <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-emails" style={{ width: `${g.progress}%` }} />
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function RemindersCard({
  reminders,
  onChange,
}: {
  reminders: JarvisReminder[];
  onChange: (next: JarvisReminder[]) => Promise<unknown>;
}) {
  const now = Date.now();
  const open = reminders.filter((r) => !r.done);
  const today = open.filter((r) => isSameDay(r.when, now)).sort((a, b) => a.when - b.when);
  const upcoming = open.filter((r) => r.when >= startOfDay(now) + 86400000).sort((a, b) => a.when - b.when);
  const overdue = open.filter((r) => r.when < startOfDay(now)).sort((a, b) => a.when - b.when);

  async function toggle(id: string) {
    await onChange(reminders.map((r) => (r.id === id ? { ...r, done: !r.done } : r)));
  }

  return (
    <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-4">
      <CardHead label="Reminders" pin />
      <p className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
        <span>{open.length} active</span>
        <span>
          {reminders.filter((r) => r.done).length}/{reminders.length}
        </span>
      </p>
      <div className="mt-4 flex-1 space-y-4">
        {overdue.length ? <ReminderGroup title={`Overdue (${overdue.length})`} items={overdue} onToggle={toggle} overdue /> : null}
        <ReminderGroup title={`Today (${today.length})`} items={today} onToggle={toggle} />
        <ReminderGroup title={`Upcoming (${upcoming.length})`} items={upcoming} onToggle={toggle} />
        {open.length === 0 ? <p className="text-[13px] text-ink-soft">Nothing waiting. The board is clear.</p> : null}
      </div>
    </section>
  );
}

function ReminderGroup({
  title,
  items,
  onToggle,
  overdue,
}: {
  title: string;
  items: JarvisReminder[];
  onToggle: (id: string) => void;
  overdue?: boolean;
}) {
  if (!items.length && !overdue) {
    return (
      <div>
        <p className="hud-label">{title}</p>
        <p className="mt-2 text-[12px] text-ink-soft">None.</p>
      </div>
    );
  }
  if (!items.length) return null;
  return (
    <div>
      <p className="hud-label">{title}</p>
      <ul className="mt-2 space-y-2.5">
        {items.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onToggle(r.id)}
              className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-canvas-2"
            >
              <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line">
                {r.done ? <Check size={11} /> : null}
              </span>
              <span className="min-w-0 flex-1 text-[13px] leading-snug">{r.title}</span>
              <span className={cn("shrink-0 pt-0.5 text-[11px]", overdue ? "text-marketing" : "text-ink-soft")}>
                {formatReminderWhen(r.when)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RepliesCard({
  replies,
  onChange,
}: {
  replies: JarvisReply[];
  onChange: (next: JarvisReply[]) => Promise<unknown>;
}) {
  const pending = useMemo(() => replies.filter((r) => !r.done), [replies]);

  async function clear(id: string) {
    await onChange(replies.map((r) => (r.id === id ? { ...r, done: true } : r)));
  }

  return (
    <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-4">
      <CardHead label="People to reply to" pin />
      <p className="mt-2 text-[11px] text-ink-soft">{pending.length} pending</p>
      <ul className="mt-4 flex-1 space-y-4">
        {pending.length === 0 ? (
          <li className="text-[13px] text-ink-soft">Inbox is clear. Nobody is waiting on a reply.</li>
        ) : (
          pending.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => clear(p.id)}
                className="flex w-full items-start justify-between gap-3 rounded-lg px-1 py-1 text-left hover:bg-canvas-2"
              >
                <span>
                  <span className="block text-[14px] leading-snug">{p.name}</span>
                  <span className="mt-0.5 block text-[12px] text-ink-soft">{p.note}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn("text-[11px]", p.daysWaiting >= 7 ? "text-marketing" : "text-ink-soft")}>
                    {p.daysWaiting}d
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">Done</span>
                </span>
              </button>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function CardHead({
  label,
  pin,
  children,
}: {
  label: string;
  pin?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="hud-label flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
        {label}
        {pin ? <Pin size={10} className="opacity-50" /> : null}
      </p>
      {children}
    </div>
  );
}

function formatReminderWhen(ts: number) {
  const now = Date.now();
  if (isSameDay(ts, now)) {
    return new Date(ts).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
