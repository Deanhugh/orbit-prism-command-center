"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Calendar,
  CalendarClock,
  CircleHelp,
  LayoutDashboard,
  MessageSquare,
  Newspaper,
  NotebookPen,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  Settings,
  Users,
  Video,
} from "lucide-react";
import { cn, formatClock } from "@/lib/utils";
import { APP_HOME } from "@/lib/home";
import { useJarvisHub } from "@/components/jarvis/useJarvisHub";
import { applyAppearance, defaultAppearance } from "@/lib/jarvis-appearance";

const APPS = [
  { href: "/jarvis/briefing", label: "Briefing", icon: Newspaper, ai: true },
  { href: "/jarvis/calendar", label: "Calendar", icon: Calendar, ai: true },
  { href: "/jarvis/knowledge", label: "Knowledgebase", icon: BookOpen, ai: true },
  { href: "/jarvis/notepad", label: "Notepad", icon: NotebookPen, ai: true },
  { href: "/jarvis/scheduling", label: "Scheduling Agent", icon: CalendarClock, ai: true },
  { href: "/jarvis/crm", label: "Social CRM", icon: Users, ai: true },
  { href: "/jarvis/meetings", label: "Meeting Intel", icon: Video, ai: true },
] as const;

const SYSTEM = [
  { href: "/jarvis/guide", label: "How to Use", icon: CircleHelp, ai: false },
  { href: "/agents", label: "Agents office", icon: MessageSquare, ai: false },
] as const;

function isActive(pathname: string, href: string) {
  if (href === APP_HOME) return pathname === APP_HOME;
  return pathname === href || pathname.startsWith(href + "/");
}

export function JarvisShell({
  username,
  children,
  needsGuest = false,
}: {
  username: string;
  children: React.ReactNode;
  needsGuest?: boolean;
}) {
  const { hub } = useJarvisHub();
  const pathname = usePathname() || APP_HOME;
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [clock, setClock] = useState("--:--:--");
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("orbit-jarvis-sidebar-v2");
      if (saved === "1") setOpen(true);
      if (saved === "0") setOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!needsGuest) return;
    fetch("/api/auth/guest", {
      method: "POST",
      headers: { Accept: "application/json" },
    }).catch(() => {});
  }, [needsGuest]);

  useEffect(() => {
    try {
      applyAppearance(hub?.appearance ?? defaultAppearance());
    } catch {
      /* keep the last working tokens */
    }
  }, [hub?.appearance]);

  useEffect(() => {
    const tick = () => setClock(formatClock());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function toggleSidebar() {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem("orbit-jarvis-sidebar-v2", next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-canvas text-ink">
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col border-r border-line bg-canvas-2 transition-[width] duration-200 md:flex",
          open ? "w-[300px]" : "w-[64px]",
        )}
      >
        <SidebarBody
          open={open}
          pathname={pathname}
          username={username}
          avatarUrl={hub?.profile.logoUrl || "/profile.png"}
          onToggle={toggleSidebar}
        />
      </aside>

      {mobileNav ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            className="absolute inset-0 bg-ink/40"
            aria-label="Close menu"
            onClick={() => setMobileNav(false)}
          />
          <aside className="relative z-10 flex h-full w-[360px] flex-col border-r border-line bg-canvas-2">
            <SidebarBody
              open
              pathname={pathname}
              username={username}
              avatarUrl={hub?.profile.logoUrl || "/profile.png"}
              onToggle={() => setMobileNav(false)}
              onNavigate={() => setMobileNav(false)}
            />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-line bg-panel/80 px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="grid h-8 w-8 place-items-center rounded-lg border border-line text-ink-soft md:hidden"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <PanelLeftOpen size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="serif tabular-nums text-[13px] font-semibold text-cyan">{clock}</span>
            <button
              type="button"
              onClick={logout}
              className="hidden rounded-full border border-line px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-ink-soft hover:text-ink sm:inline"
            >
              Sign out
            </button>
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto thin-scroll">{children}</main>
      </div>
    </div>
  );
}

function SidebarBody({
  open,
  pathname,
  username,
  avatarUrl,
  onToggle,
  onNavigate,
}: {
  open: boolean;
  pathname: string;
  username: string;
  avatarUrl: string;
  onToggle: () => void;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className={cn("flex flex-col border-b border-line", open ? "items-stretch px-3 py-4" : "items-center px-1 py-3")}>
        {open ? (
          <a
            href={APP_HOME}
            onClick={onNavigate}
            title="Orbit Prism Operating System Command Center"
            className="block min-w-0"
          >
            <Image
              src="/orbit-command-center.png"
              alt="Orbit Prism Operating System Command Center"
              width={268}
              height={47}
              priority
              unoptimized
              className="h-auto w-full bg-transparent"
            />
          </a>
        ) : (
          <a
            href={APP_HOME}
            onClick={onNavigate}
            title="Command Center"
            className="sr-only"
          >
            Command Center
          </a>
        )}
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "grid h-8 w-8 place-items-center rounded-md text-ink-soft hover:bg-panel hover:text-ink",
            open ? "mt-2 self-end" : "mt-3",
          )}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          aria-expanded={open}
        >
          {open ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto thin-scroll px-2 py-3">
        <NavLink
          href={APP_HOME}
          label="Command Center"
          icon={LayoutDashboard}
          active={isActive(pathname, APP_HOME) && pathname === APP_HOME}
          open={open}
          onNavigate={onNavigate}
          hard
        />
        {open ? <p className="hud-label px-2 pb-1 pt-4">Apps</p> : <div className="my-2 h-px bg-line" />}
        {APPS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
            open={open}
            onNavigate={onNavigate}
          />
        ))}
        {open ? <p className="hud-label px-2 pb-1 pt-4">System</p> : <div className="my-2 h-px bg-line" />}
        {SYSTEM.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            active={isActive(pathname, item.href)}
            open={open}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <div className="border-t border-line px-2 py-2">
        <NavLink
          href="/jarvis/settings"
          label="Settings"
          icon={Settings}
          active={isActive(pathname, "/jarvis/settings")}
          open={open}
          onNavigate={onNavigate}
        />
        <a
          href="/jarvis/settings"
          onClick={onNavigate}
          title={username}
          className={cn(
            "mt-2 flex items-center gap-2.5 rounded-lg px-2 py-2 text-ink-soft hover:bg-panel-2 hover:text-ink",
            !open && "justify-center",
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={avatarUrl}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
          {open ? (
            <span className="min-w-0 truncate text-[12px] font-medium text-ink">{username}</span>
          ) : null}
        </a>
      </div>
    </>
  );
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  open,
  ai,
  onNavigate,
  hard = false,
}: {
  href: string;
  label: string;
  icon: typeof Newspaper;
  active: boolean;
  open: boolean;
  ai?: boolean;
  onNavigate?: () => void;
  hard?: boolean;
}) {
  const className = cn(
    "group flex items-center gap-2 rounded-lg px-2 py-2 text-[12px] transition",
    active ? "bg-cyan text-canvas" : "text-ink-soft hover:bg-panel-2 hover:text-ink",
    !open && "justify-center",
  );
  const inner = (
    <>
      <Icon size={16} className="shrink-0" />
      {open ? (
        <>
          <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          {ai ? (
            <span
              className={cn(
                "rounded px-1 text-[8px] font-bold tracking-wider",
                active ? "bg-canvas/20 text-canvas" : "text-cyan",
              )}
            >
              AI
            </span>
          ) : null}
        </>
      ) : null}
    </>
  );
  if (hard) {
    return (
      <a href={href} title={label} onClick={onNavigate} className={className}>
        {inner}
      </a>
    );
  }
  return (
    <Link
      href={href}
      title={label}
      onClick={onNavigate}
      className={className}
    >
      <Icon size={16} className="shrink-0" />
      {open ? (
        <>
          <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
          {ai ? (
            <span
              className={cn(
                "rounded px-1 text-[8px] font-bold tracking-wider",
                active ? "bg-canvas/20 text-canvas" : "text-cyan",
              )}
            >
              AI
            </span>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}
