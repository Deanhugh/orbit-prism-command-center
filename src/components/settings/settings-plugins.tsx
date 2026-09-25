"use client";

import { useEffect, useState } from "react";

interface PluginRow { id: string; label: string; via: string; status: string }
export function Plugins() {
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
          <label className="flex items-center gap-2 text-[11px]">
            <input type="checkbox" checked={data?.composioEnabled || false} onChange={(e) => enableComposio(e.target.checked)} /> Enable Composio
          </label>
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
