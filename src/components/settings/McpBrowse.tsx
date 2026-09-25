"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search } from "lucide-react";
import { connectorColor, connectorIcon } from "@/lib/connector-icons";
import { cn } from "@/lib/utils";

export interface McpCatalogRow {
  id: string;
  name: string;
  description: string;
  command: string;
  transport: "stdio" | "http" | "sse";
  enabled?: boolean;
}

function Tile({ name, id, children }: { name: string; id?: string; children?: ReactNode }) {
  const icon = id ? connectorIcon(id) : null;
  const color = (id && connectorColor(id)) || "#5b6472";
  const initials = name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  return (
    <span
      className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[11px] font-bold text-white"
      style={{ background: icon ? `#${icon.hex}` : color }}
    >
      {children || (icon ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white" aria-hidden>
          <path d={icon.path} />
        </svg>
      ) : initials)}
    </span>
  );
}

export function McpBrowse({
  catalog,
  compact,
  onEnable,
  onDisable,
  busyId,
  onCustom,
}: {
  catalog: McpCatalogRow[];
  compact?: boolean;
  onEnable: (item: McpCatalogRow) => void;
  onDisable: (item: McpCatalogRow) => void;
  busyId?: string | null;
  onCustom?: () => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return catalog;
    return catalog.filter((i) => `${i.name} ${i.description} ${i.id}`.toLowerCase().includes(s));
  }, [catalog, q]);

  return (
    <div>
      <label className="flex items-center gap-2 rounded-full border border-line bg-canvas px-3 py-1.5">
        <Search size={13} className="shrink-0 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search MCP servers"
          className="w-full bg-transparent text-[12px] outline-none placeholder:text-ink-soft/70"
        />
      </label>
      <div className={cn("mt-3 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        <button
          type="button"
          onClick={onCustom}
          className="flex items-center gap-2.5 rounded-lg border border-dashed border-line bg-panel px-2.5 py-2.5 text-left hover:bg-canvas-2"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-ink text-canvas">
            <Plus size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-semibold">Custom MCP</span>
            <span className="block truncate text-[10px] text-ink-soft">Add your own command or URL</span>
          </span>
          <ChevronRight size={14} className="shrink-0 text-ink-soft" />
        </button>
        {filtered.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5 rounded-lg border border-line bg-panel p-2.5">
            <Tile name={item.name} id={item.id} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold">{item.name}</p>
              <p className="truncate text-[10px] text-ink-soft">{item.description}</p>
            </div>
            <button
              disabled={busyId === item.id}
              onClick={() => (item.enabled ? onDisable(item) : onEnable(item))}
              className={cn(
                "shrink-0 rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide",
                item.enabled ? "border border-emails/40 text-emails" : "bg-ink text-canvas",
              )}
            >
              {busyId === item.id ? "…" : item.enabled ? "Enabled" : "Enable"}
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-full text-[11px] text-ink-soft">
            {q.trim() ? "No MCP servers match that search." : "Loading MCP apps…"}
          </p>
        )}
      </div>
      {!compact && (
        <p className="mt-3 text-[10px] text-ink-soft">
          Enabled servers are available to agents. You can also add a custom MCP below. From chat, open the <strong>+</strong> menu → MCP Servers.
        </p>
      )}
      {compact && !onCustom && (
        <Link href="/jarvis/settings?tab=mcp" className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-ops hover:underline">
          <Plus size={12} /> Browse &amp; add in Settings
        </Link>
      )}
    </div>
  );
}
