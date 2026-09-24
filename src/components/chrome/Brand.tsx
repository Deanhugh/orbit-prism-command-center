"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Orbit Prism wordmark + "Operating System Command Center" subtitle.
 * Placed in the top-left corner of every page. Links home (Agents).
 */
export function Brand({ tone = "default" }: { tone?: "default" | "dark" }) {
  const dark = tone === "dark";
  return (
    <Link
      href="/jarvis"
      title="Orbit Prism Operating System Command Center"
      className="flex flex-col leading-none"
    >
      <Image
        src="/orbit-logo-ink.png"
        alt="Orbit Prism"
        width={160}
        height={16}
        priority
        className={cn("h-[16px] w-auto", dark ? "hidden" : "dark:hidden")}
      />
      <Image
        src="/orbit-logo-white.png"
        alt="Orbit Prism"
        width={160}
        height={16}
        priority
        className={cn("h-[16px] w-auto", dark ? "block" : "hidden dark:block")}
      />
      <span
        className={cn(
          "mt-[3px] text-[7px] font-semibold uppercase tracking-[0.22em]",
          dark ? "text-white/55" : "text-ink-soft",
        )}
      >
        Operating System Command Center
      </span>
    </Link>
  );
}
