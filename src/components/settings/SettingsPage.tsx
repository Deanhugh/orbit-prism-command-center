"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { OfficeHeader } from "@/components/chrome/OfficeHeader";
import { Providers } from "@/components/settings/settings-providers";
import { Connectors } from "@/components/settings/settings-connectors";
import { Skills } from "@/components/settings/settings-skills";
import { Routines } from "@/components/settings/settings-routines";
import { VoiceSettings } from "@/components/settings/settings-voice";

export { Providers } from "@/components/settings/settings-providers";
export { Connectors } from "@/components/settings/settings-connectors";
export { Skills } from "@/components/settings/settings-skills";
export { Plugins } from "@/components/settings/settings-plugins";

type Tab = "providers" | "voice" | "connectors" | "skills" | "routines";
const TAB_LABEL: Record<Tab, string> = {
  providers: "Providers",
  voice: "Voice",
  connectors: "MCP",
  skills: "Skills",
  routines: "Routines",
};
const TAB_HREF: Record<Tab, string> = {
  providers: "/jarvis/settings?tab=providers",
  voice: "/jarvis/settings?tab=voice",
  connectors: "/jarvis/settings?tab=mcp",
  skills: "/jarvis/settings?tab=skills",
  routines: "/jarvis/settings?tab=routines",
};

function tabFromQuery(raw: string | null): Tab {
  if (raw === "mcp" || raw === "connectors") return "connectors";
  if (raw === "skills" || raw === "providers" || raw === "routines" || raw === "voice") return raw;
  return "providers";
}

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
      <OfficeHeader title="Settings" />

      <div className="mx-auto flex max-w-[900px] gap-2 px-6 py-3">
        {(["providers", "voice", "connectors", "skills", "routines"] as Tab[]).map((t) => (
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
        {tab === "voice" && <VoiceSettings />}
        {tab === "connectors" && <Connectors />}
        {tab === "skills" && <Skills />}
        {tab === "routines" && <Routines />}
      </div>
    </div>
  );
}
