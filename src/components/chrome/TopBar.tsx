"use client";

import Image from "next/image";
import { useOffice } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useNow } from "@/lib/use-now";
import { connectorColor, connectorIcon } from "@/lib/connector-icons";
import type { Connector } from "@/lib/types";
import { HeaderControls } from "./HeaderControls";

export function TopBar() {
  const connectors = useOffice((s) => s.connectors);
  const pulses = useOffice((s) => s.pulses);
  const now = useNow(1000);

  return (
    <header className="pointer-events-auto absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-4 px-5 py-3">
      <div className="flex items-center gap-3">
        <div className="flex flex-col items-start leading-none">
          <Image
            src="/orbit-logo-white.png"
            alt="Orbit Prism"
            width={258}
            height={24}
            priority
            className="h-6 w-auto"
          />
          <span className="mt-1 self-start pl-0.5 text-left text-[8px] font-semibold uppercase tracking-[0.18em] text-ink/75">
            Operating System Command Center
          </span>
        </div>
        <span className="hidden items-center gap-1 self-start pt-1 text-[10px] uppercase tracking-widest text-ink-soft sm:flex">
          <span className="text-ink-soft/60">connected to</span>
        </span>
        <div className="hidden items-center gap-1.5 md:flex">
          {connectors.slice(0, 12).map((c) => {
            const pulsing = Boolean(pulses[c.key] && now - pulses[c.key] < 1600);
            return <ConnectorChip key={c.key} c={c} pulsing={pulsing} />;
          })}
        </div>
      </div>

      <HeaderControls />
    </header>
  );
}

function ConnectorChip({ c, pulsing }: { c: Connector; pulsing: boolean }) {
  const icon = connectorIcon(c.key);
  const color = connectorColor(c.key);
  const active = c.status === "connected";

  return (
    <span
      title={active ? c.name : `${c.name} — ${c.reason ?? "unavailable"}`}
      className={cn(
        "grid h-6 w-6 place-items-center overflow-hidden rounded-md border transition",
        active ? "border-cyan/30 bg-panel-2" : "border-line/60 bg-canvas-2",
        pulsing && "pulse-glow ring-2 ring-emails",
      )}
      style={pulsing ? { boxShadow: "0 0 10px var(--color-emails)" } : undefined}
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          className="h-3.5 w-3.5"
          fill={active ? `#${icon.hex}` : "#9b958a"}
          aria-hidden
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <span
          className="text-[9px] font-bold uppercase"
          style={{ color: active ? color ?? "#4b463d" : "#9b958a" }}
        >
          {c.name.replace(/[^a-z0-9]/gi, "").slice(0, 2)}
        </span>
      )}
    </span>
  );
}
