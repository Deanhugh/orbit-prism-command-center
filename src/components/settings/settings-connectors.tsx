"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { McpBrowse, type McpCatalogRow } from "@/components/settings/McpBrowse";
import { MCP_CATALOG } from "@/lib/mcp-catalog";
import { PlatformConnections } from "@/components/settings/settings-platforms";

interface ConnRow {
  name: string;
  key: string;
  status: string;
  reason?: string;
  kind?: string;
  auth?: string;
  hasToken?: boolean;
  tools?: number;
  url?: string;
}
interface CustomRow {
  key: string;
  name: string;
  transport: string;
  target: string;
  auth?: string;
  hasToken?: boolean;
}
interface ConnData {
  live: boolean;
  reason: string;
  connectors: ConnRow[];
  deny: string[];
  custom: CustomRow[] | string[];
  catalog?: McpCatalogRow[];
}

function customList(raw: ConnData["custom"]): CustomRow[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "string") return (raw as string[]).map((key) => ({ key, name: key, transport: "http", target: "" }));
  return raw as CustomRow[];
}

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
  const [banner] = useState(() => {
    if (typeof window === "undefined") return "";
    const q = new URLSearchParams(window.location.search);
    const ok = q.get("mcp_ok");
    const err = q.get("mcp_error");
    if (ok) return `${ok} connected.`;
    if (err) return err;
    return "";
  });
  const load = () => fetch("/api/settings/connectors").then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const customs = customList(data?.custom || []);

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
      body: JSON.stringify({
        name: item.name,
        transport: item.transport,
        target: item.command,
        auth: item.auth || (item.remote ? "oauth" : "none"),
      }),
    });
    await load();
    setBusyId(null);
    if (item.remote) {
      document.getElementById("enabled-mcp")?.scrollIntoView({ behavior: "smooth" });
    }
  }
  async function disable(item: McpCatalogRow) {
    setBusyId(item.id);
    if (item.remote) await remove(item.name);
    else await toggle(item.name, true);
    setBusyId(null);
  }

  const notion = data?.connectors.find((c) => c.key === "notion");
  const apify = data?.connectors.find((c) => c.key === "apify");
  const krea = data?.connectors.find((c) => c.key === "krea" || c.key === "kreaai");
  const apifyUrl = MCP_CATALOG.find((i) => i.id === "apify")?.command || "https://mcp.apify.com";
  const kreaUrl = MCP_CATALOG.find((i) => i.id === "krea")?.command || "https://api.krea.ai/mcp";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <a href="#browse-mcp" className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">Browse MCP</a>
        <a href="#add-mcp" className="rounded-full border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink">Add MCP</a>
      </div>
      {banner ? (
        <p
          className={cn(
            "rounded-md border px-3 py-2 text-[12px]",
            /connected/i.test(banner)
              ? "border-emails/40 bg-panel text-ink"
              : "border-finance/50 bg-finance/10 text-ink",
          )}
        >
          {banner}
        </p>
      ) : null}

      <NotionPanel
        row={notion}
        onSaved={load}
      />
      <ApifyPanel
        row={apify}
        url={apifyUrl}
        onSaved={load}
      />
      <KreaPanel
        row={krea}
        url={kreaUrl}
        onSaved={load}
      />

      <section id="browse-mcp" className="rounded-lg border border-line bg-panel p-4">
        <h2 className="mb-1 text-[12px] font-bold uppercase tracking-widest text-ink-soft">Browse MCP</h2>
        <p className="mb-3 text-[11px] text-ink-soft">
          Remote apps (Notion, Apify, Krea, GitHub, Stripe) go live on Railway with OAuth or a token. Local <code className="text-ink">npx</code> servers stay for a machine with Claude Code.
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
          Twenty, Bigcapital, Plane, and TryPost. Open only when you need to connect one — they each probe the network.
        </p>
        <div className="space-y-3">
          <PlatformConnections />
        </div>
      </details>

      <AddConnector onAdded={load} />

      <section id="enabled-mcp" className="rounded-lg border border-line bg-panel p-4">
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Enabled MCP servers</h2>
        <p className="mt-1 text-[11px] text-ink-soft">{data?.reason}</p>
      </section>
      <div className="space-y-2">
        {(data?.connectors || []).map((c) => {
          const denied = data?.deny.some((n) => n.toLowerCase() === c.name.toLowerCase()) || c.status === "denied";
          const isCustom = customs.some((x) => x.key === c.key);
          return (
            <RemoteRow
              key={c.key}
              c={c}
              denied={Boolean(denied)}
              isCustom={isCustom}
              onToggle={() => toggle(c.name, !denied)}
              onRemove={() => remove(c.name)}
              onSaved={load}
            />
          );
        })}
      </div>
    </div>
  );
}

function NotionPanel({ row, onSaved }: { row?: ConnRow; onSaved: () => void }) {
  const live = row?.status === "connected";
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : "bg-finance")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Notion — live remote MCP</h2>
        <span className="text-[10px] text-ink-soft">{row?.reason || "Not connected yet"}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
        This is the pattern for every remote app: HTTP URL + OAuth or a Bearer token. Agents search Notion on live tasks.
        Create an integration at{" "}
        <a className="underline" href="https://www.notion.so/my-integrations" target="_blank" rel="noreferrer">notion.so/my-integrations</a>
        {" "}and share pages with it, or use Connect with Notion.
      </p>
      <AuthActions name="Notion" url="https://mcp.notion.com/mcp" auth="oauth" onSaved={onSaved} hasToken={row?.hasToken} placeholder="Bearer token (Notion ntn_ / secret_ …)" />
    </section>
  );
}

function ApifyPanel({ row, url, onSaved }: { row?: ConnRow; url: string; onSaved: () => void }) {
  const live = row?.status === "connected";
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : "bg-finance")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Apify — live remote MCP</h2>
        <span className="text-[10px] text-ink-soft">{row?.reason || "Not connected yet"}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
        Agents scrape websites and social media through Apify Store Actors (web fetch, Instagram, Google search, plus Store search).
        Same connection type as Notion: HTTP URL + OAuth or a token. Create a token at{" "}
        <a className="underline" href="https://console.apify.com/settings/integrations" target="_blank" rel="noreferrer">console.apify.com → Integrations</a>
        . Actor runs use your Apify credits.
      </p>
      <AuthActions name="Apify" url={url} auth="oauth" onSaved={onSaved} hasToken={row?.hasToken} placeholder="APIFY_TOKEN from Apify Console" />
    </section>
  );
}

function KreaPanel({ row, url, onSaved }: { row?: ConnRow; url: string; onSaved: () => void }) {
  const live = row?.status === "connected";
  return (
    <section className="rounded-lg border border-line bg-panel p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : "bg-finance")} />
        <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Krea — live remote MCP</h2>
        <span className="text-[10px] text-ink-soft">{row?.reason || "Not connected yet"}</span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-soft">
        Agents generate images and video through Krea (Krea 2, Flux, Veo, Kling, upscale). Same connection type as Notion:
        Streamable HTTP at <code className="text-ink">https://api.krea.ai/mcp</code> + OAuth or a token. The page at{" "}
        <a className="underline" href="https://www.krea.ai/mcp" target="_blank" rel="noreferrer">www.krea.ai/mcp</a>
        {" "}is the setup guide. Create a token at{" "}
        <a className="underline" href="https://www.krea.ai/app/api/tokens" target="_blank" rel="noreferrer">krea.ai/app/api/tokens</a>
        {" "}or Connect with Krea. Jobs bill your Krea workspace.
      </p>
      <AuthActions name="Krea" url={url} auth="oauth" onSaved={onSaved} hasToken={row?.hasToken} placeholder="KREA_API_TOKEN from krea.ai/app/api/tokens" />
    </section>
  );
}

function AuthActions({
  name,
  url,
  auth,
  onSaved,
  hasToken,
  placeholder,
}: {
  name: string;
  url?: string;
  auth?: string;
  onSaved: () => void;
  hasToken?: boolean;
  placeholder?: string;
}) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function saveToken() {
    if (!token.trim()) return;
    setBusy("save");
    setMsg("");
    const res = await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, transport: "http", target: url, auth: auth || "bearer", token: token.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setToken("");
    setMsg(d.test?.ok ? `Live — ${d.test.reason}` : d.message || d.error || "Saved");
    onSaved();
  }

  async function test() {
    setBusy("test");
    setMsg("");
    const res = await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, test: true }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(null);
    setMsg(d.test?.ok ? `Test passed — ${d.test.reason}` : d.test?.reason || d.error || "Test failed");
    onSaved();
  }

  const oauthHref = `/api/settings/connectors/oauth/start?name=${encodeURIComponent(name)}`;

  return (
    <div className="mt-3 space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={hasToken ? "•••• token saved — paste to replace" : (placeholder || "Bearer token")}
          className="w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]"
        />
        <button
          type="button"
          onClick={saveToken}
          disabled={busy !== null || !token.trim()}
          className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40"
        >
          {busy === "save" ? "Saving…" : "Save token"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={oauthHref}
          className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink"
        >
          Connect with OAuth →
        </a>
        <button
          type="button"
          onClick={test}
          disabled={busy !== null}
          className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-40"
        >
          {busy === "test" ? "Testing…" : "Test"}
        </button>
        {msg ? <span className="text-[11px] text-ink-soft">{msg}</span> : null}
      </div>
    </div>
  );
}

function RemoteRow({
  c,
  denied,
  isCustom,
  onToggle,
  onRemove,
  onSaved,
}: {
  c: ConnRow;
  denied: boolean;
  isCustom: boolean;
  onToggle: () => void;
  onRemove: () => void;
  onSaved: () => void;
}) {
  const remote = c.kind === "remote";
  return (
    <div className="rounded-lg border border-line bg-panel p-2.5">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", c.status === "connected" && !denied ? "bg-emails" : denied ? "bg-marketing" : "bg-finance")} />
        <span className="text-[12px] font-semibold">{c.name}</span>
        {c.kind === "remote" && <span className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-soft">remote</span>}
        {isCustom && <span className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-ink-soft">added</span>}
        <span className="truncate text-[10px] text-ink-soft">
          {denied ? "blocked" : c.status}{c.reason ? ` · ${c.reason}` : ""}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <button onClick={onToggle} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">
            {denied ? "Allow" : "Block"}
          </button>
          {isCustom && (
            <button onClick={onRemove} className="rounded-md border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-marketing hover:opacity-80">
              Remove
            </button>
          )}
        </div>
      </div>
      {remote && !denied ? (
        <AuthActions name={c.name} url={c.url} auth={c.auth} onSaved={onSaved} hasToken={c.hasToken} />
      ) : null}
    </div>
  );
}

function AddConnector({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ name: "", transport: "http", target: "", args: "", token: "", auth: "oauth" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function add() {
    if (!form.name.trim() || !form.target.trim()) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/settings/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        transport: form.transport,
        target: form.target.trim(),
        args: form.args.trim(),
        auth: form.transport === "stdio" ? "none" : form.auth,
        token: form.token.trim() || undefined,
      }),
    });
    const d = await res.json();
    setSaving(false);
    if (d.error) { setMsg(d.error); return; }
    setMsg(d.message || `Saved "${form.name}".`);
    setForm({ name: "", transport: "http", target: "", args: "", token: "", auth: "oauth" });
    onAdded();
  }

  const isCmd = form.transport === "stdio";
  return (
    <section id="add-mcp" className="rounded-lg border border-line bg-panel p-4">
      <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Add a custom MCP</h2>
      <p className="mt-1 text-[11px] text-ink-soft">
        On Railway pick <strong>Remote — HTTP</strong> and a hosted <code className="text-ink">https://</code> URL, then OAuth or a token. Command (stdio) only works where Claude Code can spawn the process.
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input placeholder="Name (e.g. notion, github)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
        <select value={form.transport} onChange={(e) => setForm({ ...form, transport: e.target.value, auth: e.target.value === "stdio" ? "none" : "oauth" })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
          <option value="http">Remote — HTTP</option>
          <option value="sse">Remote — SSE</option>
          <option value="stdio">Command (stdio)</option>
        </select>
        <input
          placeholder={isCmd ? "Command (e.g. npx -y @modelcontextprotocol/server-github)" : "Server URL (https://mcp.notion.com/mcp)"}
          value={form.target}
          onChange={(e) => setForm({ ...form, target: e.target.value })}
          className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2"
        />
        {isCmd && (
          <input placeholder="Extra args (optional, space-separated)" value={form.args} onChange={(e) => setForm({ ...form, args: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] sm:col-span-2" />
        )}
        {!isCmd && (
          <>
            <select value={form.auth} onChange={(e) => setForm({ ...form, auth: e.target.value })} className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]">
              <option value="oauth">Auth — OAuth or token</option>
              <option value="bearer">Auth — Bearer token only</option>
              <option value="none">Auth — none</option>
            </select>
            <input
              type="password"
              placeholder="Token (optional if you will use OAuth)"
              value={form.token}
              onChange={(e) => setForm({ ...form, token: e.target.value })}
              className="rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]"
            />
          </>
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
