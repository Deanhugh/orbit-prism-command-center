"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DEPARTMENTS } from "@/lib/office-data";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";
import { McpBrowse, type McpCatalogRow } from "@/components/settings/McpBrowse";
import { MCP_CATALOG } from "@/lib/mcp-catalog";

type Tab = "providers" | "connectors" | "skills" | "plugins";
const TAB_LABEL: Record<Tab, string> = {
  providers: "Providers",
  connectors: "MCP",
  skills: "Skills",
  plugins: "Plugins",
};
const TAB_HREF: Record<Tab, string> = {
  providers: "/settings?tab=providers",
  connectors: "/settings?tab=mcp",
  skills: "/settings?tab=skills",
  plugins: "/settings?tab=plugins",
};

function tabFromQuery(raw: string | null): Tab {
  if (raw === "mcp" || raw === "connectors") return "connectors";
  if (raw === "skills" || raw === "plugins" || raw === "providers") return raw;
  return "providers";
}

interface ProviderRow {
  id: string; label: string; local: boolean; openaiCompatible: boolean;
  keyName: string | null; hasKey: boolean; baseUrl: string | null;
  ok: boolean; reason: string;
}
interface Cfg { provider: string; model: string; temperature: number; composio: boolean }

export function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-canvas" />}>
      <SettingsInner />
    </Suspense>
  );
}

function SettingsInner() {
  useOrbitInit();
  const params = useSearchParams();
  const tab = tabFromQuery(params.get("tab"));
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash) {
      requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }));
    }
  }, [tab]);
  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <h1 className="serif text-[15px] font-bold">Settings</h1>
        </div>
      </header>

      <div className="mx-auto flex max-w-[900px] gap-2 px-6 py-3">
        {(["providers", "connectors", "skills", "plugins"] as Tab[]).map((t) => (
          <Link
            key={t}
            href={TAB_HREF[t]}
            className={cn("rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide", tab === t ? "bg-ink text-canvas" : "border border-line text-ink-soft hover:text-ink")}
          >
            {TAB_LABEL[t]}
          </Link>
        ))}
      </div>

      <div className="mx-auto max-w-[900px] px-6 pb-16">
        {tab === "providers" && <Providers />}
        {tab === "connectors" && <Connectors />}
        {tab === "skills" && <Skills />}
        {tab === "plugins" && <Plugins />}
      </div>
    </div>
  );
}

async function probeMacOllama(): Promise<{ ok: boolean; models: string[]; reason: string }> {
  for (const url of ["http://127.0.0.1:11434/api/tags", "http://localhost:11434/api/tags"]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      const data = await res.json() as { models?: { name?: string }[] };
      const models = (data.models || []).map((m) => m.name).filter((n): n is string => Boolean(n));
      return { ok: true, models, reason: `this Mac can see Ollama (${models.length} model${models.length === 1 ? "" : "s"})` };
    } catch {
      /* CORS or not running */
    }
  }
  return { ok: false, models: [], reason: "this browser cannot reach 127.0.0.1:11434" };
}

function ollamaSplitMessage(mac: { ok: boolean; models: string[] }, serverReason: string): string {
  if (mac.ok) {
    const names = mac.models.slice(0, 6).join(", ") || "models found";
    return `Ollama is running on this Mac (${names}). This preview still cannot use it — the app server is in Cursor Cloud, not on the mini. Local Test stays red here. Use Ollama Cloud (https://ollama.com/v1 + API key), or run npm run dev on the Mac mini and open that localhost:43140.`;
  }
  return `This preview cannot reach Ollama (${serverReason}), and this browser cannot reach 127.0.0.1:11434 either. On the Mac Terminal run: curl http://127.0.0.1:11434/api/tags — if that fails, open the Ollama menu-bar app. Local Ollama will never pass Test from the Cursor cloud preview.`;
}

function Providers() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [keyDraft, setKeyDraft] = useState<Record<string, string>>({});
  const [baseDraft, setBaseDraft] = useState<Record<string, string>>({});
  const [modelDraft, setModelDraft] = useState("");
  const [banner, setBanner] = useState<{ ok: boolean; text: string } | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [rowNote, setRowNote] = useState<Record<string, { ok: boolean; text: string }>>({});

  function applyList(d: { config?: Cfg; providers?: ProviderRow[]; models?: string[] }) {
    if (d.providers) {
      setProviders((prev) => {
        if (!prev.length) return d.providers || [];
        const byId = new Map((d.providers || []).map((p) => [p.id, p]));
        return prev.map((p) => byId.get(p.id) || p);
      });
    }
    if (d.config) setCfg(d.config);
    if (d.models) setModels(d.models);
    if (typeof d.config?.model === "string") setModelDraft(d.config.model);
  }

  const load = () => fetch("/api/agents/providers").then((r) => r.json()).then(async (d) => {
    setProviders(d.providers || []);
    setCfg(d.config);
    if (typeof d.config?.model === "string") setModelDraft(d.config.model);
    const provider = d.config?.provider;
    if (provider) {
      const m = await fetch(`/api/agents/models?provider=${encodeURIComponent(provider)}`).then((r) => r.json()).catch(() => ({ models: [] }));
      setModels(m.models || []);
    } else {
      setModels(d.models || []);
    }
  });
  useEffect(() => { load(); }, []);

  async function save(patch: Record<string, unknown>, note?: string) {
    const res = await fetch("/api/agents/providers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) {
      setBanner({ ok: false, text: "Save failed." });
      return null;
    }
    const d = await res.json();
    applyList(d);
    if (note) {
      setSavedNote(note);
      setBanner(null);
    }
    return d as { config?: Cfg; models?: string[]; test?: { id: string; ok: boolean; reason: string } };
  }

  async function saveBase(id: string) {
    const url = (baseDraft[id] ?? providers.find((p) => p.id === id)?.baseUrl ?? "").trim();
    if (!url) {
      setBanner({ ok: false, text: "Enter a base URL before saving." });
      setRowNote((n) => ({ ...n, [id]: { ok: false, text: "Enter a URL first." } }));
      return;
    }
    setBusy(`save-${id}`);
    setRowNote((n) => ({ ...n, [id]: { ok: true, text: "Saving…" } }));
    const d = await save({ baseUrls: { [id]: url }, testId: id, modelsFor: id }, "");
    setBusy(null);
    if (!d) {
      setRowNote((n) => ({ ...n, [id]: { ok: false, text: "Save failed." } }));
      return;
    }
    const test = d.test;
    if (test) {
      setProviders((prev) => prev.map((p) => (p.id === id ? { ...p, ok: test.ok, reason: test.reason, baseUrl: url } : p)));
    }
    if (test?.ok) {
      const found = (d.models || []).length;
      const text = found ? `Connected — found ${found} model${found === 1 ? "" : "s"}.` : "Connected — reachable.";
      setSavedNote(`Saved base URL: ${url}`);
      setBanner({ ok: true, text: `Saved. ${text}` });
      setRowNote((n) => ({ ...n, [id]: { ok: true, text: `Saved. ${text}` } }));
    } else if (id === "ollama") {
      const mac = await probeMacOllama();
      setSavedNote(`Saved base URL: ${url}`);
      const text = ollamaSplitMessage(mac, test?.reason || "not reachable");
      setBanner({ ok: false, text });
      setRowNote((n) => ({ ...n, [id]: { ok: false, text } }));
    } else {
      setSavedNote(`Saved base URL: ${url}`);
      const text = `Connection failed — ${test?.reason || "not reachable"}.`;
      setBanner({ ok: false, text });
      setRowNote((n) => ({ ...n, [id]: { ok: false, text } }));
    }
  }

  async function saveKey(id: string, keyName: string | null) {
    if (!keyName) return;
    setBusy(`key-${id}`);
    await save({ secretName: keyName, secretValue: keyDraft[id] || "", testId: id }, "API key saved.");
    setKeyDraft((d) => ({ ...d, [id]: "" }));
    setRowNote((n) => ({ ...n, [id]: { ok: true, text: "API key saved." } }));
    setBusy(null);
  }

  async function saveModel() {
    const name = modelDraft.trim();
    if (!name) {
      setBanner({ ok: false, text: "Type a model name, then Save." });
      return;
    }
    setBusy("model");
    await save({ model: name }, `Saved. Active model is now ${name}.`);
    setSavedNote(`Saved. Active model is now ${name}.`);
    setBusy(null);
  }

  async function testProvider(id: string) {
    setBusy(`test-${id}`);
    setRowNote((n) => ({ ...n, [id]: { ok: true, text: "Testing…" } }));
    setBanner({ ok: true, text: `Testing ${id}…` });
    try {
      const res = await fetch(`/api/agents/providers?id=${encodeURIComponent(id)}`);
      const d = await res.json();
      const row = (d.providers || []).find((p: ProviderRow) => p.id === id);
      applyList({ ...d, providers: row ? [row] : [] });
      if (row?.ok) {
        const found = (d.models || []).length;
        const text = found
          ? `Test passed. Connected — ${found} model${found === 1 ? "" : "s"} available.`
          : `Test passed. Connected (${row.reason}).`;
        setBanner({ ok: true, text });
        setRowNote((n) => ({ ...n, [id]: { ok: true, text } }));
      } else if (id === "ollama") {
        const mac = await probeMacOllama();
        const text = ollamaSplitMessage(mac, row?.reason || "not reachable");
        setBanner({ ok: false, text });
        setRowNote((n) => ({ ...n, [id]: { ok: false, text } }));
      } else {
        const text = `Test failed — ${row?.reason || "not reachable"}.`;
        setBanner({ ok: false, text });
        setRowNote((n) => ({ ...n, [id]: { ok: false, text } }));
      }
    } catch {
      setBanner({ ok: false, text: "Test failed — could not reach the Orbit Prism API." });
      setRowNote((n) => ({ ...n, [id]: { ok: false, text: "Test failed." } }));
    }
    setBusy(null);
  }

  const ollama = providers.find((p) => p.id === "ollama");
  const activeSaved = Boolean(cfg?.model);

  return (
    <div className="space-y-5">
      {activeSaved && (
        <div role="status" className="rounded-lg border border-emails/40 bg-emails/10 px-3 py-2 text-[12px] text-ink">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emails">Save worked</p>
          <p className="mt-0.5 font-medium">{savedNote || `Active model is ${cfg?.provider} / ${cfg?.model}.`}</p>
        </div>
      )}
      {banner && (
        <div role="status" className={cn("rounded-lg border px-3 py-2 text-[12px] text-ink", banner.ok ? "border-emails/40 bg-emails/10" : "border-finance/40 bg-finance/10")}>
          <p className={cn("text-[10px] font-bold uppercase tracking-widest", banner.ok ? "text-emails" : "text-finance")}>
            {banner.ok ? "Connected" : "Connection note — not a save error"}
          </p>
          <p className="mt-0.5 font-medium">{banner.text}</p>
        </div>
      )}
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Active model</h2>
        <div className="flex flex-wrap items-center gap-3">
          <select value={cfg?.provider || "ollama"} onChange={(e) => save({ provider: e.target.value }, `Active provider saved: ${e.target.value}`)} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
            {providers.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
          <div className="flex min-w-[220px] flex-1 items-center gap-1">
            <input list="orbit-model-list" value={modelDraft} onChange={(e) => setModelDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveModel(); }} placeholder={models.length ? "type or pick a model" : "type the Ollama name, e.g. qwen2.5:7b"} className="w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
            <datalist id="orbit-model-list">{models.map((m) => <option key={m} value={m} />)}</datalist>
            <button onClick={saveModel} disabled={busy === "model"} className="rounded-md border border-line px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-40">{busy === "model" ? "Saving…" : "Save"}</button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ink-soft">temp<input type="range" min={0} max={1} step={0.1} value={cfg?.temperature ?? 0.6} onChange={(e) => save({ temperature: parseFloat(e.target.value) })} /><span className="tabular-nums">{cfg?.temperature ?? 0.6}</span></label>
        </div>
        {cfg?.model ? (<p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink"><span className="rounded-full bg-emails/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emails">Saved</span>Active model: <code>{cfg.provider}</code> / <code>{cfg.model}</code></p>) : (<p className="mt-2 text-[10px] text-ink-soft">Nothing saved yet — type a model name and press Save.</p>)}
        {ollama && !ollama.ok ? (<p className="mt-2 text-[10px] text-finance">Ollama is not reachable from this app server. If this tab is the Cursor cloud preview, that is expected — local Ollama lives on the Mac mini and cannot be used here. On the Mac Terminal run <code>curl http://127.0.0.1:11434/api/tags</code>. To use models from this tab, paste an Ollama Cloud key below and set the base URL to <code>https://ollama.com/v1</code>.</p>) : (<p className="mt-2 text-[10px] text-ink-soft">Recommended: <strong>Ollama</strong> — local models such as <code>qwen2.5:7b</code> and Ollama Cloud <code>:cloud</code> models share this same provider. If a provider isn&apos;t reachable, agents fall back to demo automatically.</p>)}
      </section>
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Ollama setup</h2>
        <ol className="list-decimal space-y-1 pl-4 text-[11px] text-ink-soft">
          <li>This Cursor preview cannot talk to Ollama on the Mac. Test against <code>127.0.0.1:11434</code> will stay red here.</li>
          <li>On the Mac Terminal: <code>curl http://127.0.0.1:11434/api/tags</code> — that must work before any local Test can pass.</li>
          <li>To use this preview: create a key at ollama.com, paste it in the Ollama API key field, set Base URL to <code>https://ollama.com/v1</code>, Save, Test.</li>
          <li>To use local <code>qwen2.5:7b</code>: run Orbit Prism with <code>npm run dev</code> on the Mac mini itself, then open that machine&apos;s localhost:43140.</li>
        </ol>
      </section>
      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Providers</h2>
        {providers.map((p) => (
          <div key={p.id} className="rounded-lg border border-line bg-panel p-3">
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", p.ok ? "bg-emails" : "bg-finance")} />
              <span className="text-[12px] font-semibold">{p.label}</span>
              <span className="text-[10px] text-ink-soft">{p.reason}</span>
              <button onClick={() => testProvider(p.id)} disabled={busy === `test-${p.id}`} className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops disabled:opacity-40">{busy === `test-${p.id}` ? "Testing…" : "Test"}</button>
            </div>
            {rowNote[p.id] && (<p className={cn("mt-1 text-[11px] font-medium", rowNote[p.id].ok ? "text-emails" : "text-finance")}>{rowNote[p.id].text}</p>)}
            {p.openaiCompatible && (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="text-[9px] uppercase tracking-wide text-ink-soft">Base URL</label>
                  <div className="flex gap-1">
                    <input value={baseDraft[p.id] ?? p.baseUrl ?? ""} onChange={(e) => setBaseDraft((d) => ({ ...d, [p.id]: e.target.value }))} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
                    <button onClick={() => saveBase(p.id)} disabled={busy === `save-${p.id}`} className="rounded-md border border-line px-2 text-[10px] disabled:opacity-40">{busy === `save-${p.id}` ? "Saving…" : "Save"}</button>
                  </div>
                </div>
                {p.keyName && (
                  <div>
                    <label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {p.hasKey ? "(set)" : ""}</label>
                    <div className="flex gap-1">
                      <input type="password" placeholder={p.hasKey ? "•••• saved" : p.keyName} value={keyDraft[p.id] ?? ""} onChange={(e) => setKeyDraft((d) => ({ ...d, [p.id]: e.target.value }))} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
                      <button onClick={() => saveKey(p.id, p.keyName)} disabled={busy === `key-${p.id}`} className="rounded-md border border-line px-2 text-[10px] disabled:opacity-40">{busy === `key-${p.id}` ? "Saving…" : "Save"}</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <p className="text-[10px] text-ink-soft">Keys are stored locally in <code>data/secrets.json</code> (gitignored) or read from env. Nothing is committed.</p>
      </section>
    </div>
  );
}

interface ConnRow { name: string; key: string; status: string; reason?: string }
interface ConnData { live: boolean; reason: string; connectors: ConnRow[]; deny: string[]; custom: string[]; catalog?: McpCatalogRow[] }
function Connectors() {
  const [data, setData] = useState<ConnData | null>({
    live: false, reason: "", connectors: [], deny: [], custom: [],
    catalog: MCP_CATALOG.map((item) => ({ ...item, enabled: false })),
  });
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = () => fetch("/api/settings/connectors").then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);
  async function toggle(name: string, deny: boolean) {
    await fetch("/api/settings/connectors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, deny }) });
    load();
  }
  async function remove(name: string) {
    await fetch("/api/settings/connectors", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    load();
  }
  async function enable(item: McpCatalogRow) {
    setBusyId(item.id);
    await fetch("/api/settings/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, transport: item.transport, target: item.command }) });
    await load();
    setBusyId(null);
  }
  async function disable(item: McpCatalogRow) {
    setBusyId(item.id);
    await toggle(item.name, true);
    setBusyId(null);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href="#browse-mcp" className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">Browse MCP</a>
        <a href="#add-mcp" className="rounded-full border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink">Add MCP</a>
      </div>
      <section id="browse-mcp" className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Browse MCP</h2>
        <p className="mb-3 text-[11px] text-ink-soft">Search the catalog, then Enable a server so agents can use that app. The same list is in the chat <strong>+</strong> menu.</p>
        <McpBrowse catalog={data?.catalog || []} onEnable={enable} onDisable={disable} busyId={busyId} onCustom={() => document.getElementById("add-mcp")?.scrollIntoView({ behavior: "smooth" })} />
      </section>
      <details className="rounded-lg border border-line bg-panel p-4">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-widest text-ink-soft">Department platforms</summary>
        <p className="mb-3 mt-1 text-[11px] text-ink-soft">Twenty, Bigcapital, Plane, TryPost, and Mautic. Open only when you need to connect one — they each probe the network.</p>
        <div className="space-y-3"><CrmConnection /><FinanceConnection /><PmoConnection /><MarketingConnection /><EmailConnection /></div>
      </details>
      <AddConnector onAdded={load} live={data?.live} />
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Enabled MCP servers</h2>
        <p className="mt-1 text-[11px] text-ink-soft">{data?.live ? "Live from your Claude Code (claude mcp list)." : "Saved on this machine — Enable from Browse MCP above, or add a custom server."}</p>
      </section>
      <div className="space-y-2">
        {data?.connectors.map((c) => {
          const denied = data.deny.some((n) => n.toLowerCase() === c.name.toLowerCase()) || c.status === "denied";
          const isCustom = data.custom?.includes(c.key);
          return (
            <div key={c.key} className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2.5">
              <span className={cn("h-2 w-2 rounded-full", c.status === "connected" && !denied ? "bg-emails" : denied ? "bg-marketing" : "bg-finance")} />
              <span className="text-[12px] font-semibold">{c.name}</span>
              {isCustom && <span className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-soft">added</span>}
              <span className="truncate text-[10px] text-ink-soft">{denied ? "blocked" : c.status}{c.reason ? ` · ${c.reason}` : ""}</span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button onClick={() => toggle(c.name, !denied)} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">{denied ? "Allow" : "Block"}</button>
                {isCustom && (<button onClick={() => remove(c.name)} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-marketing hover:opacity-80">Remove</button>)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddConnector({ onAdded, live }: { onAdded: () => void; live?: boolean }) {
  const [form, setForm] = useState({ name: "", transport: "stdio", target: "", args: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  async function add() {
    if (!form.name.trim() || !form.target.trim()) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/settings/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: form.name.trim(), transport: form.transport, target: form.target.trim(), args: form.args.trim() }) });
    const d = await res.json();
    setSaving(false);
    if (d.error) { setMsg(d.error); return; }
    setMsg(d.ran ? `Connected "${form.name}" — ${d.message}` : `Saved "${form.name}". ${d.message}`);
    setForm({ name: "", transport: "stdio", target: "", args: "" });
    onAdded();
  }
  const isCmd = form.transport === "stdio";
  return (
    <section id="add-mcp" className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Add a custom MCP</h2>
      <p className="mt-1 text-[11px] text-ink-soft">Not in the catalog? Add your own command or URL. {live ? "Registers with Claude Code live." : "Saved here; run on a machine with Claude Code to register it live."}</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input placeholder="Name (e.g. github, notion)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
        <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          <option value="stdio">Command (stdio)</option>
          <option value="sse">Remote — SSE</option>
          <option value="http">Remote — HTTP</option>
        </select>
        <input placeholder={isCmd ? "Command (e.g. npx -y @modelcontextprotocol/server-github)" : "Server URL (https://…)"} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        {isCmd && (<input placeholder="Extra args (optional, space-separated)" value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />)}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={add} disabled={saving || !form.name.trim() || !form.target.trim()} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Connecting…" : "Connect app"}</button>
        {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
      </div>
    </section>
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
    const res = await fetch("/api/crm/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }) });
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
      <p className="mt-1 text-[11px] text-ink-soft">Connect your <a className="underline" href="https://github.com/twentyhq/twenty" target="_blank" rel="noreferrer">Twenty</a> instance so Sales agents read &amp; write real deals. Create an API key in Twenty under Settings → API &amp; Webhooks.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.twenty.com or http://localhost:3000" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Twenty”)</label><input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.twenty.com or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "TWENTY_API_KEY"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button><span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span></div>
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
    const res = await fetch("/api/finance/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }) });
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
      <p className="mt-1 text-[11px] text-ink-soft">Connect your <a className="underline" href="https://github.com/bigcapitalhq/bigcapital" target="_blank" rel="noreferrer">Bigcapital</a> instance so Finance agents read &amp; write real invoices, bills, payments and reconciliation. Create an API key in Bigcapital settings.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.bigcapital.com or http://localhost:3000" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Bigcapital”)</label><input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.bigcapital.com or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "bc_…"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button><span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span></div>
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
    const res = await fetch("/api/pm/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, appUrl, workspace, ...(apiKey ? { apiKey } : {}) }) });
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
      <p className="mt-1 text-[11px] text-ink-soft">Connect your <a className="underline" href="https://github.com/makeplane/plane" target="_blank" rel="noreferrer">Plane</a> workspace so Engineering &amp; PMO agents read &amp; write real projects and work items, and the PMO page embeds the full platform. Create an API key in Plane settings.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL</label><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.plane.so or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Plane”)</label><input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="https://app.plane.so or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">Workspace slug</label><input value={workspace} onChange={(e) => setWorkspace(e.target.value)} placeholder="my-team" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API key {cfg?.hasKey ? "(set)" : ""}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "plane_api_…"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button><span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span></div>
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
    const res = await fetch("/api/social/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, appUrl, ...(apiKey ? { apiKey } : {}) }) });
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
      <p className="mt-1 text-[11px] text-ink-soft">Connect your <a className="underline" href="https://github.com/trypostit/trypost" target="_blank" rel="noreferrer">TryPost</a> workspace so Marketing agents draft, schedule &amp; publish real posts, and the page embeds the full platform. Create a workspace API key (Bearer token) in TryPost.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">API base URL (your APP_URL)</label><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://app.trypost.it or your self-hosted URL" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in TryPost”)</label><input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="same as base URL, usually" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div className="sm:col-span-2"><label className="text-[9px] uppercase tracking-wide text-ink-soft">API key (Bearer token) {cfg?.hasKey ? "(set)" : ""}</label><input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "workspace personal access token"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button><span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored).</span></div>
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
    const res = await fetch("/api/email/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ baseUrl, appUrl, ...(clientId ? { clientId } : {}), ...(clientSecret ? { clientSecret } : {}) }) });
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
      <p className="mt-1 text-[11px] text-ink-soft">Connect your <a className="underline" href="https://github.com/mautic/mautic" target="_blank" rel="noreferrer">Mautic</a> instance so the Email Marketing agent runs real campaigns, contacts &amp; segments. Enable the API in Mautic and create OAuth2 API credentials (client_credentials).</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">Base URL</label><input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://mautic.yourdomain.com" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">App URL (for embed / “Open in Mautic”)</label><input value={appUrl} onChange={(e) => setAppUrl(e.target.value)} placeholder="same as base URL, usually" className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">OAuth2 Client ID {cfg?.hasKey ? "(set)" : ""}</label><input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "client id"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
        <div><label className="text-[9px] uppercase tracking-wide text-ink-soft">OAuth2 Client Secret</label><input type="password" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} placeholder={cfg?.hasKey ? "•••• saved" : "client secret"} className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" /></div>
      </div>
      <div className="mt-2 flex items-center gap-2"><button onClick={save} disabled={saving} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">{saving ? "Saving…" : "Save & test"}</button><span className="text-[10px] text-ink-soft">Stored locally in <code>data/secrets.json</code> (gitignored). Basic Auth via <code>MAUTIC_BASIC_USER/PASS</code> env is also supported.</span></div>
    </section>
  );
}

interface SkillRow { name: string; description: string; department: string | null; agents: string[]; path: string }
function Skills() {
  const [skills, setSkills] = useState<SkillRow[]>([]);
  const [form, setForm] = useState({ name: "", description: "", department: "", agents: "", body: "" });
  const [msg, setMsg] = useState("");
  const load = () => fetch("/api/settings/skills").then((r) => r.json()).then((d) => setSkills(d.skills || []));
  useEffect(() => { load(); }, []);
  async function create() {
    setMsg("");
    const res = await fetch("/api/settings/skills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, agents: form.agents.split(",").map((s) => s.trim()).filter(Boolean) }) });
    const d = await res.json();
    if (d.ok) { setMsg(`Created skill "${d.name}".`); setForm({ name: "", description: "", department: "", agents: "", body: "" }); load(); }
    else setMsg(d.error || "Could not create");
  }
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Skills ({skills.length})</h2>
        {skills.map((s) => (
          <div key={s.path} className="rounded-lg border border-line bg-panel p-2.5">
            <p className="text-[12px] font-semibold">{s.name} {s.department && <span className="text-[10px] text-ink-soft">· {s.department}</span>}</p>
            <p className="text-[11px] text-ink-soft">{s.description}</p>
            {s.agents.length > 0 && <p className="mt-0.5 text-[10px] text-ink-soft">Agents: {s.agents.join(", ")}</p>}
          </div>
        ))}
      </section>
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-2 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Add a skill</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input placeholder="name (e.g. proposal)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
          <select value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
            <option value="">department (optional)</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input placeholder="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
          <input placeholder="agent ids, comma-separated (or 'all')" value={form.agents} onChange={(e) => setForm({ ...form, agents: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
          <textarea placeholder="how this work is done, step by step…" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <button onClick={create} disabled={!form.name.trim()} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">Create skill</button>
          {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
        </div>
      </section>
    </div>
  );
}

interface PluginRow { id: string; label: string; via: string; status: string }
function Plugins() {
  const [data, setData] = useState<{ composioReady: boolean; composioEnabled: boolean; catalog: PluginRow[] } | null>(null);
  const [key, setKey] = useState("");
  const load = () => fetch("/api/settings/plugins").then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);
  async function enableComposio(on: boolean) {
    await fetch("/api/agents/providers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ composio: on }) });
    load();
  }
  async function saveKey() {
    await fetch("/api/agents/providers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secretName: "COMPOSIO_API_KEY", secretValue: key }) });
    setKey(""); load();
  }
  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Plugins &amp; tools</h2>
        <p className="mt-1 text-[11px] text-ink-soft">Optional SaaS tools (Gmail, Slack, Notion). This is not the LLM — models still come from Ollama. Set a key, enable it, then those extra apps become callable.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={data?.composioEnabled || false} onChange={(e) => enableComposio(e.target.checked)} /> Enable Composio</label>
          <span className="text-[10px] text-ink-soft">{data?.composioReady ? "key set" : "no key"}</span>
          <input type="password" placeholder="COMPOSIO_API_KEY" value={key} onChange={(e) => setKey(e.target.value)} className="rounded-md border border-line bg-canvas px-2 py-1 text-[11px]" />
          <button onClick={saveKey} className="rounded-md border border-line px-2 py-1 text-[10px]">Save key</button>
        </div>
      </section>
      <div className="grid gap-2 sm:grid-cols-2">
        {data?.catalog.map((p) => (
          <div key={p.id} className="flex items-center gap-2 rounded-lg border border-line bg-panel p-2.5">
            <span className="text-[12px] font-semibold">{p.label}</span>
            <span className="ml-auto text-[10px] text-ink-soft">{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
