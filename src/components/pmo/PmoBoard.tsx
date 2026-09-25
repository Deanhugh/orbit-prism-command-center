"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
type StateGroup = (typeof STATE_GROUPS)[number];
const STATE_LABEL: Record<StateGroup, string> = {
  backlog: "Backlog", unstarted: "Todo", started: "In Progress", completed: "Done", cancelled: "Cancelled",
};

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
type Priority = (typeof PRIORITIES)[number];
const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#d64550", high: "#e0772e", medium: "#1f6feb", low: "#928d82", none: "#b7b1a6",
};

interface Project { id: string; name: string; identifier: string; description: string }
interface WorkItem { id: string; name: string; projectId: string; projectName: string; sequenceId: string; priority: Priority; stateGroup: StateGroup; stateLabel: string; assignee: string | null }
interface PlaneStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; workspace?: string; hasKey: boolean; reachable?: boolean; reason?: string }
interface Summary { totalProjects: number; totalItems: number; byState: { group: StateGroup; label: string; count: number }[]; urgent: number }
interface PmData { status: PlaneStatus; summary: Summary; projects: Project[]; workItems: WorkItem[] }

type View = "platform" | "board";

export function PmoBoard() {
  useOrbitInit();
  const [data, setData] = useState<PmData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("platform");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/pm")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => { if (view === "board") load(); }, 8000);
    return () => clearInterval(t);
  }, [view]);

  const appUrl = data?.status.appUrl;

  async function move(item: WorkItem, dir: -1 | 1) {
    const idx = STATE_GROUPS.indexOf(item.stateGroup);
    const next = STATE_GROUPS[Math.min(Math.max(idx + dir, 0), STATE_GROUPS.length - 1)];
    if (next === item.stateGroup) return;
    setBusy(item.id);
    await fetch(`/api/pm/work-items/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stateGroup: next }),
    });
    setBusy(null);
    load();
  }

  const byState = (g: StateGroup) => (data?.workItems || []).filter((w) => w.stateGroup === g);

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">PMO</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Project management · powered by Plane</span>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto px-6 py-4", view === "platform" ? "max-w-[1400px]" : "max-w-[1300px]")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-line bg-panel p-0.5">
            {(["platform", "board"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", view === v ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink")}>
                {v === "platform" ? "Platform" : "Board"}
              </button>
            ))}
          </div>
          <StatusPill status={data?.status} />
          {appUrl && (
            <a href={appUrl} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">
              Open in Plane ↗
            </a>
          )}
          {view === "board" && (
            <button onClick={() => setShowAdd((v) => !v)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">
              {showAdd ? "Close" : "+ New work item"}
            </button>
          )}
        </div>

        {view === "platform" && (
          <PlatformEmbed
            appUrl={appUrl}
            live={data?.status.mode === "live" && data?.status.reachable !== false}
            onViewBoard={() => setView("board")}
          />
        )}

        {view === "board" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Kpi label="Projects" value={data ? String(data.summary.totalProjects) : "—"} />
              <Kpi label="Work items" value={data ? String(data.summary.totalItems) : "—"} />
              <Kpi label="Urgent" value={data ? String(data.summary.urgent) : "—"} tone={data && data.summary.urgent > 0 ? "warn" : undefined} />
            </div>

            {showAdd && <AddWorkItem projects={data?.projects || []} onCreated={() => { setShowAdd(false); load(); }} />}

            {error && (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
                Couldn&apos;t load projects: {error}
                <button onClick={load} className="ml-2 underline">retry</button>
              </div>
            )}
            {!data && !error && <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">Loading board…</div>}

            {data && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {STATE_GROUPS.map((group) => {
                  const items = byState(group);
                  return (
                    <div key={group} className="rounded-lg border border-line bg-panel/60">
                      <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide">{STATE_LABEL[group]}</span>
                        <span className="text-[10px] text-ink-soft tabular-nums">{items.length}</span>
                      </div>
                      <div className="space-y-2 p-2">
                        {items.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-ink-soft">—</p>}
                        {items.map((w) => (
                          <div key={w.id} className={cn("rounded-md border border-line bg-canvas p-2.5", busy === w.id && "opacity-50")}>
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLOR[w.priority] }} title={w.priority} />
                              <span className="text-[10px] font-semibold text-ink-soft tabular-nums">{w.sequenceId}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-semibold leading-tight">{w.name}</p>
                            <p className="mt-0.5 text-[10px] text-ink-soft">{w.projectName}</p>
                            {w.assignee && <p className="mt-0.5 text-[10px] text-ink-soft">▸ {w.assignee}</p>}
                            <div className="mt-2 flex items-center justify-between">
                              <button onClick={() => move(w, -1)} disabled={group === "backlog"} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30">◀</button>
                              <button onClick={() => move(w, 1)} disabled={group === "cancelled"} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30">▶</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="mt-4 text-[10px] text-ink-soft">
          Projects &amp; work items live in{" "}
          <a href="https://github.com/makeplane/plane" className="underline" target="_blank" rel="noreferrer">Plane</a>.
          PMO agents plan the work and Engineering agents advance it — both read &amp; write these same items when they run tasks.
          Connect your instance under Settings → Connectors → PMO; until then this uses local mock projects.
        </p>
      </div>
    </div>
  );
}

function PlatformEmbed({ appUrl, live, onViewBoard }: { appUrl?: string; live?: boolean; onViewBoard: () => void }) {
  const src = useMemo(() => appUrl, [appUrl]);

  if (!live) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-lg border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-[520px]">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-canvas-2 text-[20px]">🗂️</div>
          <h2 className="serif text-[16px] font-bold">Connect Plane to load the full platform here</h2>
          <p className="mt-2 text-[12px] text-ink-soft">
            This tab embeds your real <span className="font-semibold text-ink">Plane</span> workspace. It&apos;s empty right now
            because no instance is connected yet{src ? " (and Plane&apos;s hosted cloud blocks in-page embedding — a self-hosted Plane embeds inline)" : ""}.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Your agents can already use Plane via its API — you&apos;ll see their work items appear on the <span className="font-semibold text-ink">Board</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={onViewBoard} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">View the Board →</button>
            <a href="/jarvis/settings?tab=mcp" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Connect in Settings</a>
            {src && <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">Open in Plane ↗</a>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>
          Showing your live <span className="font-semibold text-ink">Plane</span> workspace.
          If the panel below stays blank, your instance blocks embedding —
        </span>
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "78vh" }}>
        <iframe src={src} title="Plane" className="h-full w-full" referrerPolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className="text-ink-soft">{label}</span>{" "}
      <span className={cn("font-bold tabular-nums", tone === "warn" ? "text-finance" : "text-ink")}>{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status?: PlaneStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "Plane (live)" : "Plane (mock)"}</span>
      {status.reason && <span className="text-[10px] text-ink-soft">{status.reason}</span>}
    </div>
  );
}

function AddWorkItem({ projects, onCreated }: { projects: Project[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", projectId: "", priority: "medium", stateGroup: "backlog" });
  const [saving, setSaving] = useState(false);
  async function create() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/pm", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), projectId: form.projectId || undefined, priority: form.priority, stateGroup: form.stateGroup }),
    });
    setSaving(false);
    setForm({ name: "", projectId: "", priority: "medium", stateGroup: "backlog" });
    onCreated();
  }
  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input placeholder="Work item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        <select value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          <option value="">{projects.length ? "Project…" : "No projects"}</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={form.stateGroup} onChange={(e) => setForm({ ...form, stateGroup: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2">
          {STATE_GROUPS.map((g) => <option key={g} value={g}>{STATE_LABEL[g]}</option>)}
        </select>
        <button onClick={create} disabled={!form.name.trim() || saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40 sm:col-span-2">
          {saving ? "Creating…" : "Create work item"}
        </button>
      </div>
    </div>
  );
}
