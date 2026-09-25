"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface ProviderRow {
  id: string; label: string; local: boolean; openaiCompatible: boolean;
  keyName: string | null; hasKey: boolean; baseUrl: string | null;
  ok: boolean; reason: string;
}
interface Cfg { provider: string; model: string; temperature: number; composio: boolean }

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

export function Providers() {
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
        <div
          role="status"
          className={cn(
            "rounded-lg border px-3 py-2 text-[12px] text-ink",
            banner.ok ? "border-emails/40 bg-emails/10" : "border-finance/40 bg-finance/10",
          )}
        >
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
            <input
              list="orbit-model-list"
              value={modelDraft}
              onChange={(e) => setModelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveModel(); }}
              placeholder={models.length ? "type or pick a model" : "type the Ollama name, e.g. qwen2.5:7b"}
              className="w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]"
            />
            <datalist id="orbit-model-list">
              {models.map((m) => <option key={m} value={m} />)}
            </datalist>
            <button onClick={saveModel} disabled={busy === "model"} className="rounded-md border border-line px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide disabled:opacity-40">{busy === "model" ? "Saving…" : "Save"}</button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ink-soft">
            temp
            <input type="range" min={0} max={1} step={0.1} value={cfg?.temperature ?? 0.6} onChange={(e) => save({ temperature: parseFloat(e.target.value) })} />
            <span className="tabular-nums">{cfg?.temperature ?? 0.6}</span>
          </label>
        </div>
        {cfg?.model ? (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-ink">
            <span className="rounded-full bg-emails/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emails">Saved</span>
            Active model: <code>{cfg.provider}</code> / <code>{cfg.model}</code>
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-ink-soft">Nothing saved yet — type a model name and press Save.</p>
        )}
        {ollama && !ollama.ok ? (
          <p className="mt-2 text-[10px] text-finance">
            Ollama is not reachable from this app server. If this tab is the Cursor cloud preview,
            that is expected — local Ollama lives on the Mac mini and cannot be used here. On the Mac
            Terminal run <code>curl http://127.0.0.1:11434/api/tags</code>. To use models from this
            tab, paste an Ollama Cloud key below and set the base URL to <code>https://ollama.com/v1</code>.
          </p>
        ) : (
          <p className="mt-2 text-[10px] text-ink-soft">Recommended: <strong>Ollama</strong> — local models such as <code>qwen2.5:7b</code> and Ollama Cloud <code>:cloud</code> models share this same provider. If a provider isn&apos;t reachable, agents fall back to demo automatically.</p>
        )}
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
              <button
                onClick={() => testProvider(p.id)}
                disabled={busy === `test-${p.id}`}
                className="ml-auto text-[10px] font-semibold uppercase tracking-wide text-ops disabled:opacity-40"
              >
                {busy === `test-${p.id}` ? "Testing…" : "Test"}
              </button>
            </div>
            {rowNote[p.id] && (
              <p className={cn("mt-1 text-[11px] font-medium", rowNote[p.id].ok ? "text-emails" : "text-finance")}>{rowNote[p.id].text}</p>
            )}
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
