"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Brand } from "./Brand";
import { HeaderControls } from "./HeaderControls";

/**
 * Shared page header: logo + title on the left, Jarvis…Vault + Live + clock
 * flush on the right — same cluster as Command Center.
 */
export function OfficeHeader({
  title,
  subtitle,
  brand = true,
  tone = "default",
  left,
  extra,
  className,
}: {
  title?: ReactNode;
  subtitle?: string;
  brand?: boolean;
  tone?: "default" | "dark";
  left?: ReactNode;
  extra?: ReactNode;
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <header
      className={cn(
        "flex min-h-12 shrink-0 items-center gap-3 px-5 py-3 sm:px-6",
        dark ? "" : "border-b border-line bg-panel/70",
        className,
      )}
    >
      <div className="pointer-events-auto flex min-w-0 items-center gap-3">
        {brand ? <Brand tone={tone} /> : null}
        {left}
        {title ? (
          <div className="flex min-w-0 items-baseline gap-3">
            {typeof title === "string" ? (
              <h1 className={cn("serif text-[15px] font-bold", dark && "text-white")}>{title}</h1>
            ) : (
              title
            )}
            {subtitle ? (
              <span className={cn("hidden text-[11px] sm:inline", dark ? "text-white/50" : "text-ink-soft")}>
                {subtitle}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="pointer-events-auto min-w-0 flex-1 overflow-x-auto">
        <div className="flex items-center justify-end gap-3">
          <HeaderControls tone={tone} />
          {extra}
        </div>
      </div>
    </header>
  );
}
