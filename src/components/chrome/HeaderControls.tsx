"use client";

import { useEffect, useState } from "react";
import { useOffice } from "@/lib/store";
import { formatClock, cn } from "@/lib/utils";
import { PageNav } from "./PageNav";

/**
 * The shared top-right header cluster used on every page, in one order:
 * nav (Agents · Vault · Office · Settings) -> mode badge -> clock.
 */
export function HeaderControls({
  tone = "default",
  showNav = true,
}: {
  tone?: "default" | "dark";
  showNav?: boolean;
}) {
  const mode = useOffice((s) => s.mode);
  const modeReason = useOffice((s) => s.modeReason);
  const refreshMode = useOffice((s) => s.refreshMode);
  const [clock, setClock] = useState("--:--:--");

  useEffect(() => {
    const update = () => setClock(formatClock());
    const first = setTimeout(update, 0);
    const id = setInterval(update, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);

  const dark = tone === "dark";

  return (
    <div className="flex items-center gap-3">
      {showNav ? <PageNav tone={tone} /> : null}
      <button
        onClick={() => refreshMode()}
        title={modeReason}
        className={cn(
          "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition",
          mode === "live"
            ? "border-emails/40 bg-emails/10 text-emails"
            : dark ? "border-white/15 text-white/60" : "border-line bg-panel text-ink-soft",
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", mode === "live" ? "bg-emails" : "bg-finance")} />
        {mode === "live" ? "Live · Claude" : "Demo"}
      </button>
      <span className={cn("serif tabular-nums text-[13px] font-semibold", dark ? "text-white" : "text-ink")}>
        {clock}
      </span>
    </div>
  );
}
