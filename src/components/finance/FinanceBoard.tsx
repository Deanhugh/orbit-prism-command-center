"use client";

import { useEffect, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

type InvoiceState = "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE";
type BillState = "OPEN" | "APPROVED" | "PAID";

interface Invoice { id: string; invoiceNo: string; customerName: string; amount: number; currency: string; status: InvoiceState; dueDate: string | null }
interface Bill { id: string; billNo: string; vendorName: string; amount: number; currency: string; status: BillState; dueDate: string | null }
interface Payment { id: string; type: "received" | "made"; party: string; amount: number; date: string; reference: string | null; reconciled: boolean }
interface Account { id: string; name: string; code: string; type: string; normal: "debit" | "credit"; currency: string; balance: number }
interface Summary { currency: string; cash: number; arOutstanding: number; apOwed: number; overdueCount: number; revenue: number; expenses: number; net: number; unreconciled: number }
interface BooksStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
interface FinanceData { status: BooksStatus; summary: Summary; invoices: Invoice[]; bills: Bill[]; payments: Payment[]; accounts: Account[] }

type Tab = "invoices" | "bills" | "payments" | "accounts";
type View = "dashboard" | "books";

function money(n: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}
function shortDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

const INV_COLOR: Record<InvoiceState, string> = {
  DRAFT: "#928d82", SENT: "#1f6feb", PARTIAL: "#c98a3a", PAID: "#35b26a", OVERDUE: "#d64550",
};
const BILL_COLOR: Record<BillState, string> = { OPEN: "#c98a3a", APPROVED: "#1f6feb", PAID: "#35b26a" };

export function FinanceBoard() {
  useOrbitInit();
  const [data, setData] = useState<FinanceData | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("invoices");
  const [view, setView] = useState<View>("dashboard");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/finance")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, []);

  async function markPaid(inv: Invoice) {
    setBusy(inv.id);
    await fetch(`/api/finance/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    setBusy(null);
    load();
  }

  const s = data?.summary;
  const appUrl = data?.status.appUrl;

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Finance</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">The books · powered by Bigcapital</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-6 py-4">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-line bg-panel p-0.5">
            {(["dashboard", "books"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", view === v ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink")}>
                {v === "dashboard" ? "Dashboard" : "Full books"}
              </button>
            ))}
          </div>
          <StatusPill status={data?.status} />
          {appUrl && (
            <a href={appUrl} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">
              Open in Bigcapital ↗
            </a>
          )}
          {view === "dashboard" && (
            <button onClick={() => setShowAdd((v) => !v)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">
              {showAdd ? "Close" : "+ New invoice"}
            </button>
          )}
        </div>

        {view === "books" && <BooksEmbed appUrl={appUrl} live={data?.status.mode === "live"} />}

        {view === "dashboard" && (
        <>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Cash position" value={s ? money(s.cash) : "—"} />
          <Kpi label="AR outstanding" value={s ? money(s.arOutstanding) : "—"} />
          <Kpi label="AP owed" value={s ? money(s.apOwed) : "—"} />
          <Kpi label="Revenue" value={s ? money(s.revenue) : "—"} />
          <Kpi label="Net" value={s ? money(s.net) : "—"} tone={s && s.net < 0 ? "bad" : "good"} />
          <Kpi label="Overdue" value={s ? String(s.overdueCount) : "—"} tone={s && s.overdueCount > 0 ? "warn" : undefined} sub={s ? `${s.unreconciled} unreconciled` : ""} />
        </div>

        {showAdd && <AddInvoice onCreated={() => { setShowAdd(false); load(); }} />}

        {error && (
          <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
            Couldn&apos;t load the books: {error}
            <button onClick={load} className="ml-2 underline">retry</button>
          </div>
        )}
        {!data && !error && <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">Loading books…</div>}

        {data && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {(["invoices", "bills", "payments", "accounts"] as Tab[]).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide", tab === t ? "bg-ink text-canvas" : "border border-line text-ink-soft hover:text-ink")}>
                  {t === "accounts" ? "Chart of accounts" : t} <span className="opacity-60">{t === "invoices" ? data.invoices.length : t === "bills" ? data.bills.length : t === "payments" ? data.payments.length : data.accounts.length}</span>
                </button>
              ))}
            </div>

            {tab === "invoices" && (
              <Table head={["Invoice", "Customer", "Amount", "Due", "Status", ""]}>
                {data.invoices.map((inv) => (
                  <tr key={inv.id} className={cn("border-t border-line", busy === inv.id && "opacity-50")}>
                    <Td className="font-semibold">{inv.invoiceNo}</Td>
                    <Td>{inv.customerName}</Td>
                    <Td className="tabular-nums">{money(inv.amount, inv.currency)}</Td>
                    <Td className="text-ink-soft">{shortDate(inv.dueDate)}</Td>
                    <Td><Badge label={inv.status} color={INV_COLOR[inv.status]} /></Td>
                    <Td>
                      {inv.status !== "PAID" && inv.status !== "DRAFT" && (
                        <button onClick={() => markPaid(inv)} className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Mark paid</button>
                      )}
                    </Td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "bills" && (
              <Table head={["Bill", "Vendor", "Amount", "Due", "Status"]}>
                {data.bills.map((b) => (
                  <tr key={b.id} className="border-t border-line">
                    <Td className="font-semibold">{b.billNo}</Td>
                    <Td>{b.vendorName}</Td>
                    <Td className="tabular-nums">{money(b.amount, b.currency)}</Td>
                    <Td className="text-ink-soft">{shortDate(b.dueDate)}</Td>
                    <Td><Badge label={b.status} color={BILL_COLOR[b.status]} /></Td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "payments" && (
              <Table head={["Date", "Type", "Party", "Reference", "Amount", "Reconciled"]}>
                {data.payments.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <Td className="text-ink-soft">{shortDate(p.date)}</Td>
                    <Td><Badge label={p.type === "received" ? "IN" : "OUT"} color={p.type === "received" ? "#35b26a" : "#c98a3a"} /></Td>
                    <Td>{p.party}</Td>
                    <Td className="text-ink-soft">{p.reference || "—"}</Td>
                    <Td className="tabular-nums">{money(p.amount)}</Td>
                    <Td>{p.reconciled ? <span className="text-emails">✓ matched</span> : <span className="text-finance">unmatched</span>}</Td>
                  </tr>
                ))}
              </Table>
            )}

            {tab === "accounts" && (
              <Table head={["Account", "Code", "Type", "Normal", "Currency", "Balance"]}>
                {data.accounts.map((a) => (
                  <tr key={a.id} className="border-t border-line">
                    <Td className="font-semibold">{a.name}</Td>
                    <Td className="text-ink-soft tabular-nums">{a.code}</Td>
                    <Td>{a.type}</Td>
                    <Td className="text-ink-soft">{a.normal === "debit" ? "↑ Debit" : "↓ Credit"}</Td>
                    <Td className="text-ink-soft">{a.currency}</Td>
                    <Td className="tabular-nums">{a.balance ? money(a.balance, a.currency) : "—"}</Td>
                  </tr>
                ))}
              </Table>
            )}
          </>
        )}
        </>
        )}

        <p className="mt-4 text-[10px] text-ink-soft">
          The books are read from and written to{" "}
          <a href="https://github.com/bigcapitalhq/bigcapital" className="underline" target="_blank" rel="noreferrer">Bigcapital</a>.
          Finance agents raise invoices, record bills, take payments, and reconcile here when they run tasks. Connect your
          instance under Settings → Connectors → Finance; until then this uses local mock books.
        </p>
      </div>
    </div>
  );
}

function BooksEmbed({ appUrl, live }: { appUrl?: string; live?: boolean }) {
  if (!appUrl) {
    return (
      <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">
        <p className="text-ink">No Bigcapital app URL set.</p>
        <p className="mt-1">Add your Bigcapital web address under <a href="/settings" className="underline">Settings → Connectors → Finance</a> to embed the full books here.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>
          Showing the live <span className="font-semibold text-ink">Bigcapital</span> app{live ? "" : " — connect your instance in Settings to see your real books"}.
          If the panel below stays blank, your instance blocks embedding —
        </span>
        <a href={appUrl} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "72vh" }}>
        <iframe
          src={appUrl}
          title="Bigcapital"
          className="h-full w-full"
          referrerPolicy="no-referrer"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
        />
      </div>
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  const color = tone === "bad" ? "text-finance" : tone === "warn" ? "text-finance" : tone === "good" ? "text-emails" : "text-ink";
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className={cn("mt-0.5 text-[16px] font-bold tabular-nums", color)}>{value}</p>
      {sub && <p className="text-[9px] text-ink-soft">{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status?: BooksStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "Bigcapital (live)" : "Bigcapital (mock)"}</span>
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

function AddInvoice({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState({ customerName: "", amount: "", status: "SENT" });
  const [saving, setSaving] = useState(false);
  async function create() {
    if (!form.customerName.trim()) return;
    setSaving(true);
    await fetch("/api/finance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerName: form.customerName.trim(), amount: form.amount ? Number(form.amount) : 0, status: form.status }),
    });
    setSaving(false);
    setForm({ customerName: "", amount: "", status: "SENT" });
    onCreated();
  }
  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <div className="grid gap-2 sm:grid-cols-4">
        <input placeholder="Customer" value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        <input placeholder="Amount" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value.replace(/[^\d.]/g, "") })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          {(["DRAFT", "SENT"] as const).map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <button onClick={create} disabled={!form.customerName.trim() || saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40 sm:col-span-4">
          {saving ? "Creating…" : "Raise invoice"}
        </button>
      </div>
    </div>
  );
}
