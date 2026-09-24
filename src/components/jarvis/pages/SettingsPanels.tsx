"use client";

import { useState, type FormEvent } from "react";
import { Minus, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  COLOR_FIELDS,
  PALETTES,
  applyAppearance,
  type ChromeMode,
  type ColorKey,
  type JarvisAppearance,
} from "@/lib/jarvis-appearance";
import type { JarvisCrmTaxonomy } from "@/lib/jarvis-data";

export function AppearancePanel({
  value,
  onChange,
}: {
  value: JarvisAppearance;
  onChange: (next: JarvisAppearance) => Promise<unknown>;
}) {
  function commit(next: JarvisAppearance) {
    applyAppearance(next);
    return onChange(next);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <h2 className="hud-label">Chrome</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            title="Battle Station"
            blurb="Helmeted, branded cards, full shell"
            selected={value.chrome === "battle"}
            onClick={() => void commit({ ...value, chrome: "battle" })}
          />
          <ChoiceCard
            title="Minimal"
            blurb="Slim default chrome"
            selected={value.chrome === "minimal"}
            onClick={() => void commit({ ...value, chrome: "minimal" as ChromeMode })}
          />
        </div>
      </section>

      <section>
        <h2 className="hud-label">Brand</h2>
        <div className="mt-3 rounded-2xl border border-cyan/30 bg-canvas-2 px-4 py-3">
          <div className="flex items-center justify-between">
            <span>
              <span className="block text-[14px]">Orbit Prism</span>
              <span className="mt-0.5 block text-[12px] text-ink-soft">
                One operating style — Inter, JetBrains Mono, cyan on #0A0514.
              </span>
            </span>
            <span className="flex -space-x-1">
              {["#0A0514", "#1C1F26", "#68BCD3", "#FFFFFF"].map((c) => (
                <span key={c} className="h-5 w-5 rounded-full border border-line" style={{ background: c }} />
              ))}
            </span>
          </div>
        </div>
      </section>

      <section>
        <h2 className="hud-label">Custom colors</h2>
        <p className="mt-1 text-[12px] text-ink-soft">
          Override individual color variables. Empty uses the preset default. Changes preview live.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {COLOR_FIELDS.map((field) => (
            <ColorRow
              key={field.key}
              label={field.label}
              fallback={PALETTES.orbit.colors[field.key]}
              value={value.colors[field.key] || ""}
              onChange={(hex) => {
                const colors = { ...value.colors, [field.key]: hex };
                if (!hex) delete colors[field.key as ColorKey];
                void commit({ ...value, colors });
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function ChoiceCard({
  title,
  blurb,
  selected,
  onClick,
}: {
  title: string;
  blurb: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left",
        selected ? "border-cyan bg-canvas-2" : "border-line hover:border-cyan/40",
      )}
    >
      <span className="block text-[14px]">{title}</span>
      <span className="mt-0.5 block text-[12px] text-ink-soft">{blurb}</span>
    </button>
  );
}

function ColorRow({
  label,
  value,
  fallback,
  onChange,
}: {
  label: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}) {
  const shown = value || fallback;
  return (
    <label className="flex items-center gap-3 rounded-full border border-line bg-canvas-2 px-4 py-2.5">
      <input
        type="color"
        value={/^#([0-9a-fA-F]{6})$/.test(shown) ? shown : fallback}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-6 cursor-pointer rounded-full border-0 bg-transparent p-0"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px]">{label}</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="w-full bg-transparent font-mono text-[11px] text-ink-soft outline-none"
        />
      </span>
    </label>
  );
}

export function AccountPanel({ guest }: { guest: boolean }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNote("");
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current, next, confirm }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not change password.");
      setCurrent("");
      setNext("");
      setConfirm("");
      setNote("Password updated.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-2xl space-y-4">
      <h2 className="hud-label">Change password</h2>
      {guest ? (
        <p className="text-[13px] text-ink-soft">
          This is a guest session. Create a local account on the login page if you want a password you can change.
        </p>
      ) : null}
      <Field label="Current password" type="password" value={current} onChange={setCurrent} />
      <Field label="New password" type="password" value={next} onChange={setNext} />
      <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} />
      {note ? <p className="text-[12px] text-ink-soft">{note}</p> : null}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={busy || guest}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-50"
        >
          <Save size={12} />
          Change password
        </button>
      </div>
    </form>
  );
}

export function CrmPanel({
  value,
  onChange,
}: {
  value: JarvisCrmTaxonomy;
  onChange: (next: JarvisCrmTaxonomy) => Promise<unknown>;
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <StringList
        title="Labels"
        hint="Colored tags shown on each contact and the missed-connection log."
        items={value.labels}
        onChange={(labels) => onChange({ ...value, labels })}
      />
      <StringList
        title="Categories"
        hint="Primary type shown in the table dropdown."
        items={value.categories}
        onChange={(categories) => onChange({ ...value, categories })}
      />
      <StringList
        title="Statuses"
        hint="Lifecycle state for each contact."
        items={value.statuses}
        onChange={(statuses) => onChange({ ...value, statuses })}
      />
    </div>
  );
}

export function GreetingsPanel({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  const [saved, setSaved] = useState(false);

  async function persist(next: string[]) {
    await onChange(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1400);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h2 className="hud-label">Today widget greetings</h2>
      <p className="text-[12px] text-ink-soft">
        Phrases the Today widget rotates. Use {"{name}"} to insert the owner’s first name.
      </p>
      <ul className="space-y-2">
        {value.map((line, i) => (
          <li key={`${line}-${i}`} className="flex items-center gap-2">
            <input
              value={line}
              onChange={(e) => {
                const next = [...value];
                next[i] = e.target.value;
                void persist(next);
              }}
              className="min-w-0 flex-1 rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
            />
            <button
              type="button"
              onClick={() => void persist(value.filter((_, idx) => idx !== i))}
              className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink"
              aria-label="Remove greeting"
            >
              <Minus size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Hello, {name}."
          className="min-w-0 flex-1 rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const clean = draft.trim();
            if (!clean) return;
            void persist([...value, clean]);
            setDraft("");
          }}
          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-2 text-[11px] font-bold uppercase"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void persist(value)}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase text-canvas"
        >
          <Save size={12} />
          {saved ? "Saved" : "Save greetings"}
        </button>
      </div>
    </div>
  );
}

function StringList({
  title,
  hint,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  items: string[];
  onChange: (next: string[]) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section>
      <h2 className="hud-label">{title}</h2>
      <p className="mt-1 text-[12px] text-ink-soft">{hint}</p>
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={`${item}-${i}`} className="flex items-center gap-2">
            <input
              value={item}
              onChange={(e) => {
                const next = [...items];
                next[i] = e.target.value;
                void onChange(next);
              }}
              className="min-w-0 flex-1 rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
            />
            <button
              type="button"
              onClick={() => void onChange(items.filter((_, idx) => idx !== i))}
              className="grid h-8 w-8 place-items-center text-ink-soft hover:text-ink"
              aria-label={`Remove ${title.slice(0, -1).toLowerCase()}`}
            >
              <Minus size={14} />
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Add ${title.toLowerCase().slice(0, -1)}`}
          className="min-w-0 flex-1 rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
        />
        <button
          type="button"
          onClick={() => {
            const clean = draft.trim();
            if (!clean) return;
            void onChange([...items, clean]);
            setDraft("");
          }}
          className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-2 text-[11px] font-bold uppercase"
        >
          Add
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="hud-label">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-full border border-line bg-canvas-2 px-4 py-2.5 text-[13px] outline-none"
      />
    </label>
  );
}
