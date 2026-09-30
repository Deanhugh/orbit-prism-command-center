"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Orbit Prism wordmark + "Operating System Command Center" subtitle.
 * Placed in the top-left corner of every page. Links home (Jarvis).
 * Use size="office" in the Agents Office left column so the mark stays readable
 * without Jarvis / Agents pills beside it.
 */
export function Brand({
  tone = "default",
  size = "default",
}: {
  tone?: "default" | "dark";
  size?: "default" | "office";
}) {
  const dark = tone === "dark";
  const office = size === "office";
  return (
    <Link
      href="/jarvis"
      title="Orbit Prism Operating System Command Center"
      className="flex min-w-0 flex-col leading-none"
    >
      <Image
        src="/orbit-logo-ink.png"
        alt="Orbit Prism"
        width={office ? 200 : 160}
        height={office ? 20 : 16}
        priority
        className={cn("w-auto max-w-full", office ? "h-[20px]" : "h-[16px]", dark ? "hidden" : "dark:hidden")}
      />
      <Image
        src="/orbit-logo-white.png"
        alt="Orbit Prism"
        width={office ? 200 : 160}
        height={office ? 20 : 16}
        priority
        className={cn("w-auto max-w-full", office ? "h-[20px]" : "h-[16px]", dark ? "block" : "hidden dark:block")}
      />
      <span
        className={cn(
          "font-semibold uppercase",
          office
            ? "mt-1 text-[9px] tracking-[0.14em]"
            : "mt-[3px] text-[7px] tracking-[0.22em]",
          dark ? "text-white/55" : "text-ink-soft",
        )}
      >
        Operating System Command Center
      </span>
    </Link>
  );
}
