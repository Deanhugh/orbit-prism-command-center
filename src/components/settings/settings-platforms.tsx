"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function PlatformConnections() {
  return (
    <>
      <CrmConnection />
      <FinanceConnection />
      <PmoConnection />
      <MarketingConnection />
      <EmailConnection />
    </>
  );
}

interface CrmCfg { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
function CrmConnection() {
  const [cfg, setCfg] = useState<CrmCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/crm/config").then((r) => r.json()).then((d) => { setCfg(d); setBaseUrl(d.baseUrl || ""); setAppUrl(d.appUrl || ""); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/crm/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json();
    setCfg(d); setApiKey(""); setSaving(false);
  }

  const live = cfg?.mode === "live" && cfg?.reachable !== false;
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : cfg?.mode === "live" ? "bg-finance" : "bg-sales")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">CRM — Twenty</h2>
        <span className="text-[10px] text-ink-soft">{cfg ? (cfg.mode === "live" ? `live · ${cfg.reason || ""}` : "using local mock data") : ""}</span>
        <a href="/sales" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops">Open board →</a>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Connect your <a className="underline" href="https://github.com/twentyhq/twenty" target="_blank" rel="noreferrer">Twenty</a> instance so Sales agents read &amp; write real deals. Create an API key in Twenty under Settings → API &amp; Webhooks.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.twenty.com or http://localhost:3000" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Twenty”)</label>
          <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.twenty.com or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "TWENTY_API_KEY"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button>
        <span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span>
      </div>
    </section>
  );
}

interface BooksCfg { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
function FinanceConnection() {
  const [cfg, setCfg] = useState<BooksCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/finance/config").then((r) => r.json()).then((d) => { setCfg(d); setBaseUrl(d.baseUrl || ""); setAppUrl(d.appUrl || ""); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/finance/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json();
    setCfg(d); setApiKey(""); setSaving(false);
  }

  const live = cfg?.mode === "live" && cfg?.reachable !== false;
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : cfg?.mode === "live" ? "bg-finance" : "bg-sales")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Finance — Bigcapital</h2>
        <span className="text-[10px] text-ink-soft">{cfg ? (cfg.mode === "live" ? `live · ${cfg.reason || ""}` : "using local mock books") : ""}</span>
        <a href="/finance" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops">Open books →</a>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Connect your <a className="underline" href="https://github.com/bigcapitalhq/bigcapital" target="_blank" rel="noreferrer">Bigcapital</a> instance so Finance agents read &amp; write real invoices, bills, payments and reconciliation. Create an API key in Bigcapital settings.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.bigcapital.com or http://localhost:3000" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Bigcapital”)</label>
          <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.bigcapital.com or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "bc_…"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button>
        <span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span>
      </div>
    </section>
  );
}

interface PmCfg { mode: "live" | "mock"; baseUrl: string; appUrl?: string; workspace?: string; hasKey: boolean; reachable?: boolean; reason?: string }
function PmoConnection() {
  const [cfg, setCfg] = useState<PmCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/pm/config").then((r) => r.json()).then((d) => { setCfg(d); setBaseUrl(d.baseUrl || ""); setAppUrl(d.appUrl || ""); setWorkspace(d.workspace || ""); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/pm/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, appUrl, workspace, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json();
    setCfg(d); setApiKey(""); setSaving(false);
  }

  const live = cfg?.mode === "live" && cfg?.reachable !== false;
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : cfg?.mode === "live" ? "bg-finance" : "bg-sales")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">PMO — Plane</h2>
        <span className="text-[10px] text-ink-soft">{cfg ? (cfg.mode === "live" ? `live · ${cfg.reason || ""}` : "using local mock projects") : ""}</span>
        <a href="/pmo" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops">Open PMO →</a>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Connect your <a className="underline" href="https://github.com/makeplane/plane" target="_blank" rel="noreferrer">Plane</a> workspace so Engineering &amp; PMO agents read &amp; write real projects and work items, and the PMO page embeds the full platform. Create an API key in Plane settings.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.plane.so or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Plane”)</label>
          <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.plane.so or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">Workspace slug</label>
          <input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="my-team" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "plane_api_…"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button>
        <span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span>
      </div>
    </section>
  );
}

interface SocialCfg { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
function MarketingConnection() {
  const [cfg, setCfg] = useState<SocialCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/social/config").then((r) => r.json()).then((d) => { setCfg(d); setBaseUrl(d.baseUrl || ""); setAppUrl(d.appUrl || ""); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/social/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }),
    });
    const d = await res.json();
    setCfg(d); setApiKey(""); setSaving(false);
  }

  const live = cfg?.mode === "live" && cfg?.reachable !== false;
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : cfg?.mode === "live" ? "bg-finance" : "bg-sales")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Marketing — TryPost</h2>
        <span className="text-[10px] text-ink-soft">{cfg ? (cfg.mode === "live" ? `live · ${cfg.reason || ""}` : "using local mock posts") : ""}</span>
        <a href="/marketing" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops">Open Marketing →</a>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Connect your <a className="underline" href="https://github.com/trypostit/trypost" target="_blank" rel="noreferrer">TryPost</a> workspace so Marketing agents draft, schedule &amp; publish real posts, and the page embeds the full platform. Create a workspace API key (Bearer token) in TryPost.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL (your APP_URL)</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.trypost.it or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in TryPost”)</label>
          <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="same as base URL, usually" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div className="sm:col-span-2">
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">API key (Bearer token) {cfg?.hasKey ? "(set)" : ""}</label>
          <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "workspace personal access token"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button>
        <span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span>
      </div>
    </section>
  );
}

interface EmailCfg { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; auth: string; reachable?: boolean; reason?: string }
function EmailConnection() {
  const [cfg, setCfg] = useState<EmailCfg | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [appUrl, setAppUrl] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch("/api/email/config").then((r) => r.json()).then((d) => { setCfg(d); setBaseUrl(d.baseUrl || ""); setAppUrl(d.appUrl || ""); });
  useEffect(() => { load(); }, []);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/email/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ baseUrl, appUrl, ...(clientId ? { clientId } : {}), ...(clientSecret ? { clientSecret } : {}) }),
    });
    const d = await res.json();
    setCfg(d); setClientId(""); setClientSecret(""); setSaving(false);
  }

  const live = cfg?.mode === "live" && cfg?.reachable !== false;
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : cfg?.mode === "live" ? "bg-finance" : "bg-sales")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Email — Mautic</h2>
        <span className="text-[10px] text-ink-soft">{cfg ? (cfg.mode === "live" ? `live · ${cfg.reason || ""}` : "using local mock emails") : ""}</span>
        <a href="/email" className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops">Open Email →</a>
      </div>
      <p className="mt-1 text-[11px] text-ink-soft">
        Connect your <a className="underline" href="https://github.com/mautic/mautic" target="_blank" rel="noreferrer">Mautic</a> instance so the Email Marketing agent runs real campaigns, contacts &amp; segments. Enable the API in Mautic and create OAuth2 API credentials (client_credentials).
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">Base URL</label>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://mautic.yourdomain.com" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Mautic”)</label>
          <input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="same as base URL, usually" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">OAuth2 Client ID {cfg?.hasKey ? "(set)" : ""}</label>
          <input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "client id"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
        <div>
          <label className="text-[9px] uppercase tracking-wide text-ink-soft">OAuth2 Client Secret</label>
          <input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "client secret"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button>
        <span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored). Basic Auth via <code>MAUTIC_BASIC_USER/PASS</code> env is also supported.</span>
      </div>
    </section>
  );
}
