"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const PRIMARY = [
  { href: "/jarvis", label: "Jarvis" },
  { href: "/agents", label: "Agents" },
] as const;

const REST = [
  { href: "/pmo", label: "PMO" },
  { href: "/sales", label: "Sales" },
  { href: "/finance", label: "Finance" },
  { href: "/marketing", label: "Marketing" },
  { href: "/studio", label: "Studio" },
  { href: "/cad", label: "CAD" },
  { href: "/vault", label: "Vault" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Shared office-page nav. Lives in the top-right HeaderControls cluster
 * (Jarvis · Agents · PMO · Sales · Finance · Marketing · Studio · CAD · Vault).
 * The Agents Office left column shows
 * only the Orbit Prism wordmark — not this bar.
 */
export function PageNav({
  tone = "default",
}: {
  tone?: "default" | "dark";
}) {
  const pathname = usePathname() || "/";
  const dark = tone === "dark";
  return (
    <nav className="flex flex-wrap items-center gap-1" aria-label="Office pages">
      {PRIMARY.map((it) => (
        <NavPill key={it.href} href={it.href} label={it.label} active={isActive(pathname, it.href)} dark={dark} />
      ))}
      {REST.map((it) => (
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
