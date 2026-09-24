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
