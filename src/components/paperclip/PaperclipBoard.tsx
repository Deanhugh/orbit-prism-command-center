"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

const ISSUE_STATUSES = ["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled"] as const;
type IssueStatus = (typeof ISSUE_STATUSES)[number];
const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
type Priority = (typeof PRIORITIES)[number];
const PRIORITY_COLOR: Record<Priority, string> = {
  urgent: "#d64550", high: "#e0772e", medium: "#1f6feb", low: "#928d82", none: "#b7b1a6",
};

interface Issue {
  id: string;
  identifier: string;
  title: string;
  status: IssueStatus;
  priority: Priority;
  projectName: string | null;
  assignee: string | null;
}
interface PaperclipStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; companyId?: string; hasKey: boolean; reachable?: boolean; reason?: string }
interface Summary { totalIssues: number; byStatus: { status: IssueStatus; label: string; count: number }[]; urgent: number }
interface BoardData { status: PaperclipStatus; summary: Summary; issues: Issue[] }

type View = "platform" | "board";

export function PaperclipBoard() {
  useOrbitInit();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("platform");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/paperclip")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => { if (view === "board") load(); }, 8000);
    return () => clearInterval(t);
  }, [view]);

  const appUrl = data?.status.appUrl;

  async function move(item: Issue, dir: -1 | 1) {
    const idx = ISSUE_STATUSES.indexOf(item.status);
    const next = ISSUE_STATUSES[Math.min(Math.max(idx + dir, 0), ISSUE_STATUSES.length - 1)];
    if (next === item.status) return;
    setBusy(item.id);
    await fetch(`/api/paperclip/issues/${item.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    load();
  }

  const byStatus = (s: IssueStatus) => (data?.issues || []).filter((w) => w.status === s);

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Paperclip</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Agent issues · powered by Paperclip</span>
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
              Open in Paperclip ↗
            </a>
          )}
          {view === "board" && (
            <button onClick={() => setShowAdd((v) => !v)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">
              {showAdd ? "Close" : "+ New issue"}
            </button>
          )}
        </div>

        {view === "platform" && (
          <PlatformEmbed
            appUrl={appUrl}
            live={Boolean(appUrl) && data?.status.reachable !== false && (data?.status.mode === "live" || Boolean(data?.status.baseUrl))}
            onViewBoard={() => setView("board")}
          />
        )}

        {view === "board" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Kpi label="Issues" value={data ? String(data.summary.totalIssues) : "—"} />
              <Kpi label="High / urgent" value={data ? String(data.summary.urgent) : "—"} tone={data && data.summary.urgent > 0 ? "warn" : undefined} />
            </div>

            {showAdd && <AddIssue onCreated={() => { setShowAdd(false); load(); }} />}

            {error && (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
                Couldn&apos;t load issues: {error}
                <button onClick={load} className="ml-2 underline">retry</button>
              </div>
            )}
            {!data && !error && <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">Loading board…</div>}

            {data && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {ISSUE_STATUSES.map((status) => {
                  const items = byStatus(status);
                  return (
                    <div key={status} className="rounded-lg border border-line bg-panel/60">
                      <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <span className="text-[11px] font-bold uppercase tracking-wide">{STATUS_LABEL[status]}</span>
                        <span className="text-[10px] text-ink-soft tabular-nums">{items.length}</span>
                      </div>
                      <div className="space-y-2 p-2">
                        {items.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-ink-soft">—</p>}
                        {items.map((w) => (
                          <div key={w.id} className={cn("rounded-md border border-line bg-canvas p-2.5", busy === w.id && "opacity-50")}>
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_COLOR[w.priority] }} title={w.priority} />
                              <span className="text-[10px] font-semibold text-ink-soft tabular-nums">{w.identifier}</span>
                            </div>
                            <p className="mt-1 text-[12px] font-semibold leading-tight">{w.title}</p>
                            {w.projectName && <p className="mt-0.5 text-[10px] text-ink-soft">{w.projectName}</p>}
                            {w.assignee && <p className="mt-0.5 text-[10px] text-ink-soft">▸ {w.assignee}</p>}
                            <div className="mt-2 flex items-center justify-between">
                              <button onClick={() => move(w, -1)} disabled={status === "backlog"} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30">◀</button>
                              <button onClick={() => move(w, 1)} disabled={status === "cancelled"} className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30">▶</button>
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
          Issues live in{" "}
          <a href="https://github.com/paperclipai/paperclip" className="underline" target="_blank" rel="noreferrer">Paperclip</a>.
          Jarvis, PMO, and Engineering open work here instead of only using Orbit&apos;s in-memory task list.
          Connect your instance under Settings → Connectors → Paperclip; until then this uses local mock issues.
        </p>
      </div>
    </div>
  );
}

function PlatformEmbed({ appUrl, live, onViewBoard }: { appUrl?: string; live?: boolean; onViewBoard: () => void }) {
  const src = useMemo(() => appUrl, [appUrl]);

  if (!live || !src) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-lg border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-[520px]">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-canvas-2 text-[20px]">📎</div>
          <h2 className="serif text-[16px] font-bold">Connect Paperclip to load the full platform here</h2>
          <p className="mt-2 text-[12px] text-ink-soft">
            This tab embeds your real <span className="font-semibold text-ink">Paperclip</span> instance. It&apos;s empty right now
            because no instance is connected yet.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Your agents can already use Paperclip via its API — you&apos;ll see their issues appear on the <span className="font-semibold text-ink">Board</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={onViewBoard} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">View the Board →</button>
            <a href="/jarvis/settings?tab=mcp" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Connect in Settings</a>
            {src && <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">Open in Paperclip ↗</a>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>
          Showing your live <span className="font-semibold text-ink">Paperclip</span> instance.
          If the panel below stays blank, your instance blocks embedding —
        </span>
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "78vh" }}>
        <iframe src={src} title="Paperclip" className="h-full w-full" referrerPolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
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

function StatusPill({ status }: { status?: PaperclipStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "Paperclip (live)" : "Paperclip (mock)"}</span>
      {status.reason && <span className="text-[10px] text-ink-soft">{status.reason}</span>}
    </div>
  );
}

function AddIssue({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ title: "", priority: "medium", status: "todo" });
  const [saving, setSaving] = useState(false);
  async function create() {
    if (!form.title.trim()) return;
    setSaving(true);
    await fetch("/api/paperclip", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title.trim(), priority: form.priority, status: form.status }),
    });
    setSaving(false);
    setForm({ title: "", priority: "medium", status: "todo" });
    onCreated();
  }
  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input placeholder="Issue title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          {ISSUE_STATUSES.map((g) => <option key={g} value={g}>{STATUS_LABEL[g]}</option>)}
        </select>
        <button onClick={create} disabled={!form.title.trim() || saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40 sm:col-span-4">
          {saving ? "Creating…" : "Create issue"}
        </button>
      </div>
    </div>
  );
}
