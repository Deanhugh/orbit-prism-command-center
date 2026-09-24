"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

type EmailState = "DRAFT" | "SENT";
const STATE_COLOR: Record<EmailState, string> = { DRAFT: "#928d82", SENT: "#35b26a" };

interface EmailItem { id: string; name: string; subject: string; fromAddress: string | null; status: EmailState; sentCount: number; readCount: number; segment: string | null }
interface Campaign { id: string; name: string; published: boolean; contacts: number }
interface Contact { id: string; name: string; email: string | null; stage: string | null }
interface Segment { id: string; name: string; contacts: number }
interface EmailStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; auth: string; reachable?: boolean; reason?: string }
interface Summary { totalEmails: number; sent: number; drafts: number; totalSent: number; avgOpenRate: number; campaigns: number; contacts: number }
interface EmailData { status: EmailStatus; summary: Summary; emails: EmailItem[]; campaigns: Campaign[]; segments: Segment[]; contacts: Contact[] }

type View = "platform" | "board";
type Tab = "emails" | "campaigns" | "contacts";

function num(n: number) { return n.toLocaleString(); }

export function EmailBoard() {
  useOrbitInit();
  const [data, setData] = useState<EmailData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("platform");
  const [tab, setTab] = useState<Tab>("emails");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/email")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => { if (view === "board") load(); }, 8000);
    return () => clearInterval(t);
  }, [view]);

  const appUrl = data?.status.appUrl;
  const s = data?.summary;

  async function send(email: EmailItem) {
    setBusy(email.id);
    await fetch(`/api/email/emails/${email.id}/send`, { method: "POST" });
    setBusy(null);
    load();
  }

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Email</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Email marketing · powered by Mautic</span>
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
              Open in Mautic ↗
            </a>
          )}
          {view === "board" && (
            <button onClick={() => setShowAdd((v) => !v)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">
              {showAdd ? "Close" : "+ New email"}
            </button>
          )}
        </div>

        {view === "platform" && (
          <PlatformEmbed appUrl={appUrl} live={data?.status.mode === "live" && data?.status.reachable !== false} onViewBoard={() => setView("board")} />
        )}

        {view === "board" && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi label="Emails" value={s ? String(s.totalEmails) : "—"} />
              <Kpi label="Sent" value={s ? String(s.sent) : "—"} />
              <Kpi label="Drafts" value={s ? String(s.drafts) : "—"} />
              <Kpi label="Total sent" value={s ? num(s.totalSent) : "—"} />
              <Kpi label="Avg open" value={s ? `${s.avgOpenRate}%` : "—"} tone="good" />
              <Kpi label="Contacts" value={s ? num(s.contacts) : "—"} />
            </div>

            {showAdd && <AddEmail segments={data?.segments || []} onCreated={() => { setShowAdd(false); load(); }} />}

            {error && (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
                Couldn&apos;t load emails: {error}
                <button onClick={load} className="ml-2 underline">retry</button>
              </div>
            )}
            {!data && !error && <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">Loading…</div>}

            {data && (
              <>
                <div className="mb-3 flex gap-2">
                  {(["emails", "campaigns", "contacts"] as Tab[]).map((t) => (
                    <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide", tab === t ? "bg-ink text-canvas" : "border border-line text-ink-soft hover:text-ink")}>
                      {t} <span className="opacity-60">{t === "emails" ? data.emails.length : t === "campaigns" ? data.campaigns.length : data.contacts.length}</span>
                    </button>
                  ))}
                </div>

                {tab === "emails" && (
                  <Table head={["Email", "Subject", "Segment", "Sent", "Opens", "Status", ""]}>
                    {data.emails.map((e) => (
                      <tr key={e.id} className={cn("border-t border-line", busy === e.id && "opacity-50")}>
                        <Td className="font-semibold">{e.name}</Td>
                        <Td className="text-ink-soft">{e.subject}</Td>
                        <Td className="text-ink-soft">{e.segment || "—"}</Td>
                        <Td className="tabular-nums">{e.sentCount ? num(e.sentCount) : "—"}</Td>
                        <Td className="tabular-nums">{e.sentCount ? `${Math.round((e.readCount / e.sentCount) * 100)}%` : "—"}</Td>
                        <Td><Badge label={e.status} color={STATE_COLOR[e.status]} /></Td>
                        <Td>{e.status === "DRAFT" && <button onClick={() => send(e)} className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Send</button>}</Td>
                      </tr>
                    ))}
                  </Table>
                )}

                {tab === "campaigns" && (
                  <Table head={["Campaign", "Status", "Contacts"]}>
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="border-t border-line">
                        <Td className="font-semibold">{c.name}</Td>
                        <Td><Badge label={c.published ? "Live" : "Paused"} color={c.published ? "#35b26a" : "#928d82"} /></Td>
                        <Td className="tabular-nums">{num(c.contacts)}</Td>
                      </tr>
                    ))}
                  </Table>
                )}

                {tab === "contacts" && (
                  <Table head={["Name", "Email", "Stage"]}>
                    {data.contacts.map((c) => (
                      <tr key={c.id} className="border-t border-line">
                        <Td className="font-semibold">{c.name}</Td>
                        <Td className="text-ink-soft">{c.email || "—"}</Td>
                        <Td>{c.stage && <Badge label={c.stage} color="#1f6feb" />}</Td>
                      </tr>
                    ))}
                  </Table>
                )}
              </>
            )}
          </>
        )}

        <p className="mt-4 text-[10px] text-ink-soft">
          Emails, campaigns &amp; contacts live in{" "}
          <a href="https://github.com/mautic/mautic" className="underline" target="_blank" rel="noreferrer">Mautic</a>.
          The Email Marketing agent drafts and sends these same emails when they run tasks.
          Connect your instance under Settings → Connectors → Email; until then this uses local mock data.
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
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-canvas-2 text-[20px]">✉️</div>
          <h2 className="serif text-[16px] font-bold">Connect Mautic to load the full platform here</h2>
          <p className="mt-2 text-[12px] text-ink-soft">
            This tab embeds your real <span className="font-semibold text-ink">Mautic</span> instance. It&apos;s empty right now
            because no instance is connected yet{src ? " (self-hosted Mautic that allows framing embeds inline; otherwise use the link)" : ""}.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            The Email Marketing agent can already use it via the API — you&apos;ll see emails on the <span className="font-semibold text-ink">Board</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={onViewBoard} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">View the Board →</button>
            <a href="/settings" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Connect in Settings</a>
            {src && <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">Open in Mautic ↗</a>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>Showing your live <span className="font-semibold text-ink">Mautic</span> instance. If the panel below stays blank, your instance blocks embedding —</span>
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "78vh" }}>
        <iframe src={src} title="Mautic" className="h-full w-full" referrerPolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: "good" }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={cn("mt-0.5 text-[16px] font-bold tabular-nums", tone === "good" ? "text-emails" : "text-ink")}>{value}</p>
    </div>
  );
}

function StatusPill({ status }: { status?: EmailStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "Mautic (live)" : "Mautic (mock)"}</span>
      {status.reason && <span className="text-[10px] text-ink-soft">{status.reason}</span>}
    </div>
  );
}

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-panel">
      <table className="w-full text-left text-[12px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-ink-soft">
            {head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn("px-3 py-2", className)}>{children}</td>;
}
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: `${color}22`, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function AddEmail({ segments, onCreated }: { segments: Segment[]; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", subject: "", segment: "" });
  const [saving, setSaving] = useState(false);
  async function create() {
    if (!form.name.trim()) return;
    setSaving(true);
    await fetch("/api/email", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), subject: form.subject || undefined, segment: form.segment || undefined }),
    });
    setSaving(false);
    setForm({ name: "", subject: "", segment: "" });
    onCreated();
  }
  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input placeholder="Email name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
        <input placeholder="Subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          <option value="">Segment…</option>
          {segments.map((sg) => <option key={sg.id} value={sg.name}>{sg.name}</option>)}
        </select>
        <button onClick={create} disabled={!form.name.trim() || saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40 sm:col-span-4">
          {saving ? "Creating…" : "Create email"}
        </button>
      </div>
    </div>
  );
}
