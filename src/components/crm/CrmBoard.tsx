"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

const STAGES = ["NEW", "SCREENING", "MEETING", "PROPOSAL", "CUSTOMER"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABEL: Record<Stage, string> = {
  NEW: "New",
  SCREENING: "Screening",
  MEETING: "Meeting",
  PROPOSAL: "Proposal",
  CUSTOMER: "Won",
};

interface Deal {
  id: string;
  name: string;
  amount: number;
  currency: string;
  stage: Stage;
  closeDate: string | null;
  companyName?: string | null;
  contactName?: string | null;
}
interface Company { id: string; name: string }
interface CrmStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
interface CrmData {
  status: CrmStatus;
  deals: Deal[];
  companies: Company[];
  summary: { stage: Stage; count: number; value: number }[];
}

type View = "platform" | "board";

function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

export function CrmBoard() {
  useOrbitInit();
  const [data, setData] = useState<CrmData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("platform");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/crm")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => { if (view === "board") load(); }, 8000);
    return () => clearInterval(t);
  }, [view]);

  const total = useMemo(
    () => (data?.summary || []).reduce((a, b) => a + b.value, 0),
    [data],
  );

  async function move(deal: Deal, dir: -1 | 1) {
    const idx = STAGES.indexOf(deal.stage);
    const next = STAGES[Math.min(Math.max(idx + dir, 0), STAGES.length - 1)];
    if (next === deal.stage) return;
    setBusy(deal.id);
    await fetch(`/api/crm/deals/${deal.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage: next }),
    });
    setBusy(null);
    load();
  }

  const byStage = (stage: Stage) => (data?.deals || []).filter((d) => d.stage === stage);
  const appUrl = data?.status.appUrl;

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Sales</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Deal flow · powered by Twenty</span>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto px-6 py-4", view === "platform" ? "max-w-[1400px]" : "max-w-[1200px]")}>
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
              Open in Twenty ↗
            </a>
          )}
          {view === "board" && (
            <>
              <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
                <span className="text-ink-soft">Total pipeline</span>{" "}
                <span className="font-bold tabular-nums">{money(total)}</span>
              </div>
              <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
                <span className="text-ink-soft">Open deals</span>{" "}
                <span className="font-bold tabular-nums">{data?.deals.length ?? 0}</span>
              </div>
              <button
                onClick={() => setShowAdd((v) => !v)}
                className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas"
              >
                {showAdd ? "Close" : "+ New deal"}
              </button>
            </>
          )}
        </div>

        {view === "platform" && (
          <PlatformEmbed appUrl={appUrl} live={data?.status.mode === "live" && data?.status.reachable !== false} onViewBoard={() => setView("board")} />
        )}

        {view === "board" && (
        <>
        {showAdd && <AddDeal companies={data?.companies || []} onCreated={() => { setShowAdd(false); load(); }} />}

        {error && (
          <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
            Couldn&apos;t load the CRM: {error}
            <button onClick={load} className="ml-2 underline">retry</button>
          </div>
        )}

        {!data && !error && (
          <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">
            Loading pipeline…
          </div>
        )}

        {data && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STAGES.map((stage) => {
              const deals = byStage(stage);
              const value = deals.reduce((a, b) => a + b.amount, 0);
              return (
                <div key={stage} className="rounded-lg border border-line bg-panel/60">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2">
                    <span className="text-[11px] font-bold uppercase tracking-wide">{STAGE_LABEL[stage]}</span>
                    <span className="text-[10px] text-ink-soft tabular-nums">{deals.length} · {money(value)}</span>
                  </div>
                  <div className="space-y-2 p-2">
                    {deals.length === 0 && (
                      <p className="px-1 py-3 text-center text-[10px] text-ink-soft">No deals</p>
                    )}
                    {deals.map((d) => (
                      <div key={d.id} className={cn("rounded-md border border-line bg-canvas p-2.5", busy === d.id && "opacity-50")}>
                        <p className="text-[12px] font-semibold leading-tight">{d.name}</p>
                        {d.companyName && <p className="mt-0.5 text-[10px] text-ink-soft">{d.companyName}</p>}
                        <p className="mt-1 text-[12px] font-bold tabular-nums">{money(d.amount, d.currency)}</p>
                        {d.contactName && <p className="mt-0.5 text-[10px] text-ink-soft">{d.contactName}</p>}
                        <div className="mt-2 flex items-center justify-between">
                          <button
                            onClick={() => move(d, -1)}
                            disabled={stage === "NEW"}
                            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30"
                          >
                            ◀
                          </button>
                          {d.closeDate && (
                            <span className="text-[9px] text-ink-soft">
                              {new Date(d.closeDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          )}
                          <button
                            onClick={() => move(d, 1)}
                            disabled={stage === "CUSTOMER"}
                            className="rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-soft hover:text-ink disabled:opacity-30"
                          >
                            ▶
                          </button>
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
          Deals are read from and written to{" "}
          <a href="https://github.com/twentyhq/twenty" className="underline" target="_blank" rel="noreferrer">Twenty</a>.
          Sales agents create and advance these same deals when they run tasks. Connect your Twenty
          instance under Settings → Connectors → CRM; until then this uses local mock data.
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
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-canvas-2 text-[20px]">🤝</div>
          <h2 className="serif text-[16px] font-bold">Connect Twenty to load the full CRM here</h2>
          <p className="mt-2 text-[12px] text-ink-soft">
            This tab embeds your real <span className="font-semibold text-ink">Twenty</span> CRM. It&apos;s empty right now
            because no instance is connected yet{src ? " (and Twenty&apos;s hosted cloud blocks in-page embedding — a self-hosted Twenty embeds inline)" : ""}.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Your Sales agents can already use the CRM via its API — you&apos;ll see their deals appear on the <span className="font-semibold text-ink">Board</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={onViewBoard} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">View the Board →</button>
            <a href="/jarvis/settings?tab=mcp" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Connect in Settings</a>
            {src && <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">Open in Twenty ↗</a>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>
          Showing your live <span className="font-semibold text-ink">Twenty</span> CRM.
          If the panel below stays blank, your instance blocks embedding —
        </span>
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "78vh" }}>
        <iframe src={src} title="Twenty" className="h-full w-full" referrerPolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
      </div>
    </div>
  );
}

function StatusPill({ status }: { status?: CrmStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "Twenty (live)" : "Twenty (mock)"}</span>
      {status.reason && <span className="text-[10px] text-ink-soft">{status.reason}</span>}
    </div>
  );
}

function AddDeal({ companies, onCreated }: { companies: Company[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", amount: "", stage: "NEW", companyId: "" });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/crm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        amount: form.amount ? Number(form.amount) : undefined,
        stage: form.stage,
        companyId: form.companyId || undefined,
      }),
    });
    setSaving(false);
    setForm({ name: "", amount: "", stage: "NEW", companyId: "" });
    onCreated();
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input
          placeholder="Deal name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2"
        />
        <input
          placeholder="Amount (e.g. 50000)"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]"
        />
        <select value={form.stage} onChange={(e) => setForm({ ...form, stage: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          {STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
        </select>
        <select value={form.companyId} onChange={(e) => setForm({ ...form, companyId: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2">
          <option value="">No company</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button
          onClick={create}
          disabled={!form.name.trim() || saving}
          className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40 sm:col-span-2"
        >
          {saving ? "Creating…" : "Create deal"}
        </button>
      </div>
    </div>
  );
}
