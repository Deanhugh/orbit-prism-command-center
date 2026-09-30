"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { connectorColor, connectorIcon } from "@/lib/connector-icons";
import { MCP_NAV_EVENT, mcpNavApps, type McpNavApp } from "@/lib/mcp-nav";
import { cn } from "@/lib/utils";

function AppMark({ app }: { app: McpNavApp }) {
  const icon = connectorIcon(app.key);
  const color = connectorColor(app.key) || "#5b6472";
  const initials = app.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[8px] font-bold text-white"
      style={{ background: icon ? `#${icon.hex}` : color }}
      aria-hidden
    >
      {icon ? (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-white">
          <path d={icon.path} />
        </svg>
      ) : (
        initials
      )}
    </span>
  );
}

export function McpNav({
  open,
  onNavigate,
  initialApps = [],
}: {
  open: boolean;
  onNavigate?: () => void;
  initialApps?: McpNavApp[];
}) {
  const [apps, setApps] = useState<McpNavApp[]>(initialApps);

  const load = useCallback(() => {
    fetch("/api/settings/connectors?nav=1")
      .then((r) => r.json())
      .then((d) => setApps(Array.isArray(d.apps) ? d.apps : mcpNavApps(d)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const onVis = () => {
      if (document.visibilityState === "visible") load();
    };
    window.addEventListener(MCP_NAV_EVENT, load);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener(MCP_NAV_EVENT, load);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load]);

  return (
    <div className="mt-1">
      {open ? <p className="hud-label px-2 pb-1 pt-3">MCP</p> : <div className="my-2 h-px bg-line" />}
      {apps.length === 0 && open ? (
        <p className="px-2 py-1 text-[10px] text-ink-soft">None enabled</p>
      ) : null}
      {apps.map((app) => (
        <Link
          key={app.key}
          href="/jarvis/settings?tab=mcp"
          title={app.name}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-ink-soft hover:bg-panel-2 hover:text-ink",
            !open && "justify-center",
          )}
        >
          <AppMark app={app} />
          {open ? <span className="min-w-0 truncate font-medium">{app.name}</span> : null}
        </Link>
      ))}
    </div>
  );
}
