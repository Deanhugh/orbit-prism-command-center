"use client";

import { useEffect, useMemo, useState } from "react";
import type { DeptId, Task, TaskStatus } from "@/lib/types";
import { DEPARTMENTS, DEPT_MAP, agentById } from "@/lib/office-data";
import { useOffice } from "@/lib/store";
import { cn, timeAgo } from "@/lib/utils";
import { useNow } from "@/lib/use-now";

const FILTERS: { id: "all" | TaskStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "backlog", label: "Backlog" },
  { id: "in_progress", label: "In progress" },
  { id: "waiting_approval", label: "Waiting" },
  { id: "done", label: "Done" },
];

function cadenceHint(text: string): string | null {
  const t = text.toLowerCase();
  if (/every\s+\d+\s*min/.test(t)) return "Repeats every few minutes";
  if (/every\s+hour|hourly/.test(t)) return "Repeats every hour";
  if (/every\s+weekday/.test(t)) return "Repeats every weekday";
  if (/every\s+(mon|tue|wed|thu|fri|sat|sun)/.test(t)) return "Repeats weekly";
  if (/every\s+day|daily/.test(t)) return "Repeats daily";
  return null;
}

export function TaskSidebar() {
  const tasks = useOffice((s) => s.tasks);
  const routines = useOffice((s) => s.routines);
  const model = useOffice((s) => s.model);
  const createTask = useOffice((s) => s.createTask);
  const actOnTask = useOffice((s) => s.actOnTask);
  const routineAction = useOffice((s) => s.routineAction);
  const selectedDept = useOffice((s) => s.selectedDept);
  const setSelectedDept = useOffice((s) => s.setSelectedDept);
  const setBrainOpen = useOffice((s) => s.setBrainOpen);

  const [dept, setDept] = useState<DeptId>("marketing");
  const [text, setText] = useState("");
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [busy, setBusy] = useState(false);
  const [brainInfo, setBrainInfo] = useState<{
    notes: number;
    skills: number;
    studio: string;
    vaultConnected: boolean;
  } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/status")
        .then((r) => r.json())
        .then((d) => {
          if (alive)
            setBrainInfo({
              notes: d.notes,
              skills: d.skills,
              studio: d.studio,
              vaultConnected: d.vaultConnected,
            });
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const activeDept = selectedDept === "all" ? dept : selectedDept;

  const counts = useMemo(() => {
    return {
      all: tasks.length,
      backlog: tasks.filter((t) => t.status === "backlog").length,
      in_progress: tasks.filter((t) => t.status === "in_progress").length,
      waiting_approval: tasks.filter((t) => t.status === "waiting_approval").length,
      done: tasks.filter((t) => t.status === "done").length,
      rejected: tasks.filter((t) => t.status === "rejected").length,
    };
  }, [tasks]);

  const visible = useMemo(() => {
    let list = tasks;
    if (selectedDept !== "all") list = list.filter((t) => t.dept === selectedDept);
    if (filter !== "all") list = list.filter((t) => t.status === filter);
    return list.slice(0, 40);
  }, [tasks, filter, selectedDept]);

  const hint = cadenceHint(text);

  async function submit() {
    const title = text.trim();
    if (!title || busy) return;
    setBusy(true);
    try {
      await createTask(title, activeDept);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className="pointer-events-auto flex h-full w-full flex-col bg-panel/80 backdrop-blur-md">
      {/* task input */}
      <div className="border-b border-line p-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={activeDept}
              onChange={(e) => {
                setDept(e.target.value as DeptId);
                if (selectedDept !== "all") setSelectedDept(e.target.value as DeptId);
              }}
              className="appearance-none rounded-full border border-line bg-canvas px-3 py-1.5 pr-7 text-[11px] font-semibold uppercase tracking-wide text-ink outline-none"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] text-ink-soft">
              ▼
            </span>
          </div>
          <span className="text-[10px] uppercase tracking-widest text-ink-soft">
            {model}
          </span>
        </div>

        <div className="mt-2 flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            placeholder={`Type a task for ${DEPT_MAP[activeDept].name}…`}
            className="min-h-[38px] flex-1 resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink-soft/60 focus:border-ink/30"
          />
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="h-[38px] rounded-lg bg-ink px-4 text-[12px] font-bold uppercase tracking-wide text-canvas transition disabled:opacity-40"
          >
            {busy ? "…" : "Add"}
          </button>
        </div>
        {hint && (
          <p className="mt-1.5 text-[10px] uppercase tracking-wide text-ops">
            ⟲ {hint} — will be scheduled
          </p>
        )}
      </div>

      {/* brain card */}
      <button
        onClick={() => setBrainOpen(true)}
        className="mx-4 mt-3 flex items-center gap-3 rounded-lg border border-line bg-canvas/60 p-3 text-left transition hover:border-ink/25"
      >
        <div className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-panel">
          <span className="text-[13px]">✦</span>
          {brainInfo && (
            <span
              title={
                brainInfo.vaultConnected
                  ? "Obsidian vault connected"
                  : "Using sample brain (vault not found on this machine)"
              }
              className={cn(
                "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-panel",
                brainInfo.vaultConnected ? "bg-emails" : "bg-finance",
              )}
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="serif text-[12px] font-bold text-ink">
            The Brain{" "}
            {brainInfo ? (
              <span className="font-normal text-ink-soft">
                {brainInfo.notes} notes · {brainInfo.skills} skills
              </span>
            ) : (
              <span className="font-normal text-ink-soft">notes</span>
            )}
          </p>
          <p className="truncate text-[10px] text-ink-soft">
            {brainInfo
              ? `${brainInfo.vaultConnected ? "Obsidian vault" : brainInfo.studio} — read before every task`
              : "Your studio's notes, read before every task"}
          </p>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
          Open →
        </span>
      </button>

      {/* task status */}
      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <h2 className="serif text-[12px] font-bold uppercase tracking-widest text-ink">
          Task Status
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-ink-soft">
          {selectedDept === "all" ? "Whole office" : DEPT_MAP[selectedDept].name}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 px-4 pb-2">
        {FILTERS.map((f) => {
          const n = counts[f.id as keyof typeof counts] ?? 0;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
                active
                  ? "border-ink bg-ink text-canvas"
                  : "border-line bg-canvas text-ink-soft hover:text-ink",
              )}
            >
              {f.label} {n}
            </button>
          );
        })}
      </div>

      {/* list */}
      <div className="thin-scroll flex-1 overflow-y-auto px-4 pb-4">
        {routines.length > 0 && filter === "all" && (
          <div className="mb-2 space-y-1.5">
            {routines.map((r) => (
              <RoutineRow key={r.id} r={r} onAction={routineAction} />
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <div className="mt-10 text-center">
            <p className="serif text-[13px] text-ink">Nothing here yet</p>
            <p className="mt-1 text-[11px] text-ink-soft">
              Pick a department and type a task to put the office to work.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {visible.map((t) => (
              <TaskRow key={t.id} task={t} onAct={actOnTask} />
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function TaskRow({
  task,
  onAct,
}: {
  task: Task;
  onAct: (id: string, a: "approve" | "reject") => void;
}) {
  const dept = DEPT_MAP[task.dept];
  const agent = agentById(task.agentId);
  const pct = Math.round(task.progress);

  return (
    <div className="fade-in-up rounded-lg border border-line bg-canvas/50 p-2.5">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: dept.accent }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-[12px] font-medium text-ink">{task.title}</p>
            <span className="shrink-0 text-[9px] uppercase tracking-wide text-ink-soft">
              {task.status === "in_progress"
                ? `${pct}%`
                : task.status === "done"
                  ? "done"
                  : task.status === "waiting_approval"
                    ? "waiting"
                    : task.status === "rejected"
                      ? "rejected"
                      : "queued"}
            </span>
          </div>
          <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-ink-soft">
            {agent?.name ?? task.agentName} · {dept.name}
            {task.scheduled && (
              <span className="ml-1 text-ops">· scheduled</span>
            )}
          </p>

          {task.status === "in_progress" && (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: dept.accent }}
              />
            </div>
          )}

          {task.status === "waiting_approval" && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="rounded-full bg-finance/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-finance">
                Needs your OK
              </span>
              <button
                onClick={() => onAct(task.id, "approve")}
                className="rounded-full bg-emails px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
              >
                Approve
              </button>
              <button
                onClick={() => onAct(task.id, "reject")}
                className="rounded-full border border-line px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-ink-soft"
              >
                Reject
              </button>
            </div>
          )}

          {task.status === "done" && task.deliverable && (
            <details className="mt-1.5 group">
              <summary className="cursor-pointer list-none text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">
                View deliverable
              </summary>
              <div className="mt-1 whitespace-pre-wrap rounded-md border border-line bg-panel p-2 text-[11px] leading-relaxed text-ink">
                {task.deliverable}
                {task.note && (
                  <p className="mt-2 text-[9px] uppercase tracking-wide text-ink-soft">
                    Filed to Brain: {task.note}
                  </p>
                )}
              </div>
            </details>
          )}
        </div>
        <span className="shrink-0 text-[9px] text-ink-soft/70">
          {timeAgo(task.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function RoutineRow({
  r,
  onAction,
}: {
  r: import("@/lib/types").Routine;
  onAction: (id: string, a: "pause" | "resume" | "run" | "delete") => void;
}) {
  const dept = DEPT_MAP[r.dept];
  const now = useNow(30000);
  const mins = now ? Math.max(0, Math.round((r.nextRun - now) / 60000)) : -1;
  const countdown =
    mins < 0
      ? "scheduled"
      : mins < 1
        ? "due now"
        : mins < 60
          ? `in ${mins}m`
          : `in ${Math.round(mins / 60)}h`;
  return (
    <div className="rounded-lg border border-ops/30 bg-ops/5 p-2.5">
      <div className="flex items-start gap-2">
        <span
          className="mt-1 h-2 w-2 shrink-0 rounded-full"
          style={{ background: dept.accent }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="rounded-full bg-ops/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ops">
              Scheduled
            </span>
            <span className="text-[9px] uppercase tracking-wide text-ink-soft">
              {r.paused ? "paused" : countdown}
            </span>
          </div>
          <p className="mt-1 truncate text-[12px] font-medium text-ink">{r.title}</p>
          <p className="text-[10px] uppercase tracking-wide text-ink-soft">
            {r.cadence} · {dept.name}
          </p>
        </div>
      </div>
      <div className="mt-1.5 flex gap-1.5 pl-4">
        <button
          onClick={() => onAction(r.id, "run")}
          className="text-[9px] font-bold uppercase tracking-wide text-emails"
        >
          Run now
        </button>
        <button
          onClick={() => onAction(r.id, r.paused ? "resume" : "pause")}
          className="text-[9px] font-bold uppercase tracking-wide text-ink-soft"
        >
          {r.paused ? "Resume" : "Pause"}
        </button>
        <button
          onClick={() => onAction(r.id, "delete")}
          className="text-[9px] font-bold uppercase tracking-wide text-marketing"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
