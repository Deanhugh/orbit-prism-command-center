"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Orbit Prism wordmark + "Operating System Command Center" subtitle.
 * Placed in the top-left corner of every page. Links home (Jarvis).
 * Use size="office" in the Agents Office left column and size="header" on
 * Marketing / Studio / Sales / PMO / CAD / Finance / Vault: the full Command
 * Center lockup (same asset as Jarvis), not the thin 16px ink bar.
 */
export function Brand({
  tone = "default",
  size = "default",
}: {
  tone?: "default" | "dark";
  size?: "default" | "office" | "header";
}) {
  const dark = tone === "dark";
  const lockup = size === "office" || size === "header";

  if (lockup) {
    const header = size === "header";
    return (
      <Link
        href="/jarvis"
        title="Orbit Prism Operating System Command Center"
        className={cn("block shrink-0", header ? "w-[220px] sm:w-[268px]" : "min-w-0")}
      >
        <Image
          src="/orbit-command-center.png"
          alt="Orbit Prism Operating System Command Center"
          width={277}
          height={60}
          priority
          unoptimized
          className={cn(
            "h-auto bg-transparent [mix-blend-mode:screen]",
            header ? "w-full" : "w-full max-w-[320px]",
          )}
        />
      </Link>
    );
  }

  return (
    <Link
      href="/jarvis"
      title="Orbit Prism Operating System Command Center"
      className="flex min-w-0 flex-col leading-none"
    >
      <Image
        src="/orbit-logo-ink.png"
        alt="Orbit Prism"
        width={160}
        height={16}
        priority
        className={cn("h-[16px] w-auto max-w-full", dark ? "hidden" : "dark:hidden")}
      />
      <Image
        src="/orbit-logo-white.png"
        alt="Orbit Prism"
        width={160}
        height={16}
        priority
        className={cn("h-[16px] w-auto max-w-full", dark ? "block" : "hidden dark:block")}
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
