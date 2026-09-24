"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/jarvis", label: "Jarvis" },
  { href: "/agents", label: "Agents" },
] as const;

const REST = [
  { href: "/marketing", label: "Marketing" },
  { href: "/email", label: "Email" },
  { href: "/sales", label: "Sales" },
  { href: "/pmo", label: "PMO" },
  { href: "/finance", label: "Finance" },
  { href: "/vault", label: "Vault" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Shared top nav. Jarvis sits immediately beside Agents and both stay
 * visible in the top-left cluster on every office page.
 */
export function PageNav({
  tone = "default",
  pairOnly = false,
}: {
  tone?: "default" | "dark";
  /** Jarvis + Agents only — for the top-left brand cluster. */
  pairOnly?: boolean;
}) {
  const pathname = usePathname() || "/";
  const dark = tone === "dark";
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label={pairOnly ? "Jarvis and Agents" : "Office pages"}>
      {PRIMARY.map((it) => (
        <NavPill key={it.href} href={it.href} label={it.label} active={isActive(pathname, it.href)} dark={dark} />
      ))}
      {pairOnly
        ? null
        : REST.map((it) => (
            <NavPill
              key={it.href}
              href={it.href}
              label={it.label}
              active={isActive(pathname, it.href)}
              dark={dark}
              className="hidden sm:inline-flex"
            />
          ))}
    </nav>
  );
}

function NavPill({
  href,
  label,
  active,
  dark,
  className,
}: {
  href: string;
  label: string;
  active: boolean;
  dark: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition",
        dark
          ? active
            ? "bg-white/15 text-white"
            : "text-white/50 hover:text-white"
          : active
            ? "bg-ink text-canvas"
            : "border border-line bg-panel text-ink-soft hover:text-ink",
        className,
      )}
    >
      {label}
    </Link>
  );
}
