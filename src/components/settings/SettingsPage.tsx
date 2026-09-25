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
  providers: "/jarvis/settings?tab=providers",
  connectors: "/jarvis/settings?tab=mcp",
  skills: "/jarvis/settings?tab=skills",
  plugins: "/jarvis/settings?tab=plugins",
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
