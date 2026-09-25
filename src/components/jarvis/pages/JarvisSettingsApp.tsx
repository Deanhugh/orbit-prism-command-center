"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  BookOpen,
  Building2,
  Handshake,
  KeyRound,
  MessageCircle,
  Palette,
  Plug,
  Save,
  Settings2,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisHub } from "../useJarvisHub";
import type { JarvisHub, JarvisProfile } from "@/lib/jarvis-data";
import { SETTINGS_TABS, settingsHref, type SettingsTab } from "@/lib/jarvis-settings";
import { AccountPanel, AppearancePanel, CrmPanel, GreetingsPanel } from "./SettingsPanels";
import { Connectors, Providers, Skills } from "@/components/settings/SettingsPage";
import { defaultAppearance } from "@/lib/jarvis-appearance";
import { defaultCrmTaxonomy, defaultGreetings } from "@/lib/jarvis-data";

const TAB_ICON: Record<SettingsTab, typeof Settings2> = {
  General: Settings2,
  Appearance: Palette,
  Account: UserRound,
  Providers: KeyRound,
  MCP: Plug,
  Skills: BookOpen,
  "Social CRM": Handshake,
  Greetings: MessageCircle,
  Sidecar: Building2,
};

export function JarvisSettingsApp({
  username,
  initialTab = "General",
  initialHub,
}: {
  username: string;
  initialTab?: SettingsTab;
  initialHub?: JarvisHub | null;
}) {
  const { hub, save } = useJarvisHub(initialHub, username);
  const tab = initialTab;
  const [form, setForm] = useState<JarvisProfile | null>(hub?.profile ?? null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hub) setForm(hub.profile);
  }, [hub]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }));
  }, [tab]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError("");
    try {
      await save({ profile: form });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1600);
    } catch {
      setError("Could not save profile.");
    }
  }

  if (!form) {
    return <p className="p-10 text-center text-[13px] text-ink-soft">Loading settings…</p>;
  }

  return (
    <div className="flex min-h-full flex-col gap-8 px-5 py-8 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-56">
        {SETTINGS_TABS.map((t) => {
          const Icon = TAB_ICON[t];
          const on = tab === t;
          return (
            <Link
              key={t}
              href={settingsHref(t)}
              className={cn(
                "mb-1 flex w-full items-center gap-2.5 rounded-full px-3 py-2 text-left text-[13px]",
                on ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink",
              )}
            >
              <Icon size={14} />
              {t}
            </Link>
          );
        })}
      </aside>
      <div className="min-w-0 flex-1">
        {tab === "General" ? (
          <form onSubmit={onSave} className="mx-auto max-w-2xl space-y-5">
            <h2 className="hud-label">Profile</h2>
            <LogoField
              value={form.logoUrl || ""}
              onChange={(logoUrl) => setForm({ ...form, logoUrl })}
            />
            <Field label="Display name" value={form.displayName} onChange={(v) => setForm({ ...form, displayName: v })} />
            <Field label="Short name" value={form.shortName} onChange={(v) => setForm({ ...form, shortName: v })} />
            <Field label="Owner name" value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} />
            <Field label="Tagline" value={form.tagline} onChange={(v) => setForm({ ...form, tagline: v })} />
            <label className="block">
              <span className="hud-label">Timezone</span>
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
              >
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Australia/Sydney">Australia/Sydney</option>
              </select>
            </label>
            {error ? <p className="text-[12px] text-marketing">{error}</p> : null}
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas"
              >
                <Save size={12} />
                {saved ? "Saved" : "Save"}
              </button>
            </div>
          </form>
        ) : null}
        {tab === "Appearance" ? (
          <AppearancePanel
            value={hub?.appearance ?? defaultAppearance()}
            onChange={(appearance) => save({ appearance })}
          />
        ) : null}
        {tab === "Account" ? (
          <div className="space-y-6">
            <p className="mx-auto max-w-2xl text-[13px] text-ink-soft">
              Signed in as <span className="text-ink">{username}</span>. This is the local Orbit Prism account
              on this machine — not your Mac login.
            </p>
            <AccountPanel guest={username.startsWith("guest-")} />
          </div>
        ) : null}
        {tab === "Providers" ? (
          <div className="mx-auto max-w-[900px]">
            <Providers />
          </div>
        ) : null}
        {tab === "MCP" ? (
          <div className="mx-auto max-w-[900px]">
            <Connectors />
          </div>
        ) : null}
        {tab === "Skills" ? (
          <div className="mx-auto max-w-[900px]">
            <Skills />
          </div>
        ) : null}
        {tab === "Social CRM" ? (
          <CrmPanel value={hub?.crm ?? defaultCrmTaxonomy()} onChange={(crm) => save({ crm })} />
        ) : null}
        {tab === "Greetings" ? (
          <GreetingsPanel value={hub?.greetings ?? defaultGreetings()} onChange={(greetings) => save({ greetings })} />
        ) : null}
        {tab === "Sidecar" ? <SidecarSettings /> : null}
      </div>
    </div>
  );
}

function LogoField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [oops, setOops] = useState("");

  function pick() {
    inputRef.current?.click();
  }

  function onFile(file?: File | null) {
    if (!file) return;
    if (file.size > 400_000) {
      setOops("Keep the logo under 400 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onChange(String(reader.result || ""));
      setOops("");
    };
    reader.readAsDataURL(file);
  }

  return (
    <div>
      <p className="hud-label">Logo</p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={pick}
          className="grid h-14 w-14 place-items-center overflow-hidden rounded-full border border-line bg-canvas-2"
          aria-label="Upload logo"
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[9px] uppercase tracking-wide text-ink-soft">No logo</span>
          )}
        </button>
        <div>
          <button
            type="button"
            onClick={pick}
            className="rounded-full bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas"
          >
            Upload logo
          </button>
          <p className="mt-1 text-[11px] text-ink-soft">
            PNG, JPG, SVG, or WebP. Shows next to the Command Center title.
          </p>
          {oops ? <p className="mt-1 text-[11px] text-marketing">{oops}</p> : null}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}

function SidecarSettings() {
  const [url, setUrl] = useState("http://127.0.0.1:8000");
  const [state, setState] = useState("");
  const [busy, setBusy] = useState("");

  useEffect(() => {
    fetch("/api/jarvis/sidecar")
      .then((r) => r.json())
      .then((d) => {
        if (d.url) setUrl(d.url);
        setState(
          d.running
            ? d.paired
              ? "Mark-LIV is running and paired."
              : "Mark-LIV is running. Pair it here if you use the desktop sidecar."
            : d.lastError || "Mark-LIV is not running on this Mac.",
        );
      })
      .catch(() => setState("Could not check the sidecar."));
  }, []);

  async function saveUrl(e: FormEvent) {
    e.preventDefault();
    setBusy("url");
    try {
      const res = await fetch("/api/jarvis/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "url", url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save.");
      setState(
        data.running
          ? "Address saved. Mark-LIV is reachable."
          : data.lastError || "Address saved. Mark-LIV is not running yet.",
      );
    } catch (err) {
      setState(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy("");
    }
  }

  async function forget() {
    setBusy("forget");
    try {
      const res = await fetch("/api/jarvis/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "forget" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not clear pairing.");
      setState("Pairing cleared. Mark-LIV is still a separate app.");
    } catch (err) {
      setState(err instanceof Error ? err.message : "Could not clear pairing.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="hud-label">Mark-LIV sidecar</h2>
      <p className="text-[13px] leading-relaxed text-ink-soft">
        Mark-LIV is an optional local desktop sidecar. The Command Center Today card is a day
        snapshot, not a chat.
      </p>
      <form onSubmit={saveUrl} className="space-y-3">
        <label className="block">
          <span className="hud-label">Local dashboard URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 font-mono text-[13px] outline-none"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy === "url"}
            className="rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
          >
            {busy === "url" ? "Saving…" : "Save address"}
          </button>
          <button
            type="button"
            onClick={forget}
            disabled={busy === "forget"}
            className="rounded-full border border-line px-4 py-2 text-[11px] font-bold uppercase disabled:opacity-50"
          >
            Clear pairing
          </button>
        </div>
      </form>
      {state ? <p className="text-[13px] text-ink-soft">{state}</p> : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="hud-label">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
      />
    </label>
  );
}
