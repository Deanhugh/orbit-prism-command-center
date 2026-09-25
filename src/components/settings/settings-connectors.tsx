"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { McpBrowse, type McpCatalogRow } from "@/components/settings/McpBrowse";
import { MCP_CATALOG } from "@/lib/mcp-catalog";
import { PlatformConnections } from "@/components/settings/settings-platforms";

interface ConnRow { name: string; key: string; status: string; reason?: string }
interface ConnData { live: boolean; reason: string; connectors: ConnRow[]; deny: string[]; custom: string[]; catalog?: McpCatalogRow[] }
export function Connectors() {
  const [data, setData] = useState<ConnData | null>({
    live: false,
    reason: "",
    connectors: [],
    deny: [],
    custom: [],
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
    await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: item.name, transport: item.transport, target: item.command }),
    });
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
        <p className="mb-3 text-[11px] text-ink-soft">
          Search the catalog, then Enable a server so agents can use that app. The same list is in the chat <strong>+</strong> menu.
        </p>
        <McpBrowse
          catalog={data?.catalog || []}
          onEnable={enable}
          onDisable={disable}
          busyId={busyId}
          onCustom={() => document.getElementById("add-mcp")?.scrollIntoView({ behavior: "smooth" })}
        />
      </section>

      <details className="rounded-lg border border-line bg-panel p-4">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-widest text-ink-soft">
          Department platforms
        </summary>
        <p className="mb-3 mt-1 text-[11px] text-ink-soft">
          Twenty, Bigcapital, Plane, TryPost, and Mautic. Open only when you need to connect one — they each probe the network.
        </p>
        <div className="space-y-3">
          <PlatformConnections />
        </div>
      </details>

      <AddConnector onAdded={load} live={data?.live} />

      <section className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Enabled MCP servers</h2>
        <p className="mt-1 text-[11px] text-ink-soft">
          {data?.live
            ? "Live from Claude Code on this machine (claude mcp list). Agents can use Enabled servers."
            : "Claude Code is not running on this host. A green Notion (or other) badge here is the saved catalog, not a live Notion login. Enable the server, then run the Command Center where Claude Code can start that MCP — or add a remote Notion MCP URL under Add a custom MCP."}
        </p>
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
                <button onClick={() => toggle(c.name, !denied)} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">
                  {denied ? "Allow" : "Block"}
                </button>
                {isCustom && (
                  <button onClick={() => remove(c.name)} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-marketing hover:opacity-80">
                    Remove
                  </button>
                )}
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
    const res = await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), transport: form.transport, target: form.target.trim(), args: form.args.trim() }),
    });
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
      <p className="mt-1 text-[11px] text-ink-soft">
        Not in the catalog? Add your own command or URL. {live ? "Registers with Claude Code live." : "Saved here; run on a machine with Claude Code to register it live."}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input placeholder="Name (e.g. github, notion)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
        <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          <option value="stdio">Command (stdio)</option>
          <option value="sse">Remote — SSE</option>
          <option value="http">Remote — HTTP</option>
        </select>
        <input
          placeholder={isCmd ? "Command (e.g. npx -y @modelcontextprotocol/server-github)" : "Server URL (https://…)"}
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2"
        />
        {isCmd && (
          <input placeholder="Extra args (optional, space-separated)" value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        )}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={add} disabled={saving || !form.name.trim() || !form.target.trim()} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">
          {saving ? "Connecting…" : "Connect app"}
        </button>
        {msg && <span className="text-[11px] text-ink-soft">{msg}</span>}
      </div>
    </section>
  );
}
