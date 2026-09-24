"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { ExternalLink, Pin, Plus, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import type { JarvisHub, JarvisNote, JarvisProject } from "@/lib/jarvis-data";

type ProjectTab = "active" | "all" | "upcoming";

export function DeckWork({
  hub,
  save,
}: {
  hub: JarvisHub;
  save: (patch: Partial<JarvisHub>) => Promise<unknown>;
}) {
  return (
    <>
      <ProjectsCard projects={hub.projects ?? []} onChange={(projects) => save({ projects })} />
      <NotepadCard notes={hub.notes ?? []} onChange={(notes) => save({ notes })} />
    </>
  );
}

function ProjectsCard({
  projects,
  onChange,
}: {
  projects: JarvisProject[];
  onChange: (next: JarvisProject[]) => Promise<unknown>;
}) {
  const [tab, setTab] = useState<ProjectTab>("active");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = projects.filter((p) => {
    if (tab === "all") return true;
    return p.status === tab;
  });

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = title.trim();
    if (!clean) return;
    setBusy(true);
    try {
      await onChange([
        ...projects,
        {
          id: `pr_${Date.now().toString(36)}`,
          title: clean,
          status: tab === "upcoming" ? "upcoming" : "active",
          done: 0,
          total: 1,
          detail: "Just opened on the deck",
          progress: 0,
        },
      ]);
      setTitle("");
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-8">
      <div className="flex items-center justify-between gap-2">
        <p className="hud-label flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
          Projects
          <Pin size={10} className="opacity-50" />
        </p>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:bg-canvas-2 hover:text-ink"
        >
          <Plus size={12} />
          Add
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1">
        {(["active", "all", "upcoming"] as ProjectTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide",
              tab === t ? "bg-ink text-canvas" : "border border-line text-ink-soft hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
      </div>
      {open ? (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="New project"
            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-ink px-3 py-2 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
          >
            Add
          </button>
        </form>
      ) : null}
      <div className="mt-5 grid flex-1 gap-6 sm:grid-cols-2">
        {shown.length === 0 ? (
          <p className="text-[13px] text-ink-soft">Nothing in this view.</p>
        ) : (
          shown.map((p) => (
            <article key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <p className="flex items-center gap-2 text-[14px] leading-snug">
                  <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
                  {p.title}
                </p>
                <span className="shrink-0 text-[11px] text-ink-soft">
                  {p.done}/{p.total}
                </span>
              </div>
              <p className="mt-2 pl-3.5 text-[12px] text-ink-soft">{p.detail}</p>
              <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-[#4d8ef5]"
                  style={{ width: `${Math.max(0, Math.min(100, p.progress))}%` }}
                />
              </div>
              <p className="mt-1 text-right text-[10px] text-ink-soft">{p.progress}%</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function NotepadCard({
  notes,
  onChange,
}: {
  notes: JarvisNote[];
  onChange: (next: JarvisNote[]) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const recent = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);

  async function saveNote() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    try {
      const title = body.split("\n")[0].slice(0, 48) || "Quick note";
      const note: JarvisNote = {
        id: `n_${Date.now().toString(36)}`,
        title,
        body,
        project: "",
        labels: ["Deck"],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await onChange([note, ...notes]);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void saveNote();
    }
  }

  return (
    <section className="hud-panel flex min-h-[280px] flex-col p-4 lg:col-span-4">
      <div className="flex items-center justify-between gap-2">
        <p className="hud-label flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
          Notepad
          <Pin size={10} className="opacity-50" />
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/jarvis/notepad"
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
          >
            Open
            <ExternalLink size={10} />
          </Link>
          <button
            type="button"
            onClick={() => void saveNote()}
            disabled={busy || !draft.trim()}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-40"
          >
            <Save size={10} />
            Save
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-ink-soft">{recent.length} recent</p>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKey}
        name="quick-note"
        aria-label="Quick note"
        placeholder="Quick note… (⌘/Ctrl + Enter)"
        className="mt-3 w-full rounded-lg border border-line bg-canvas px-3 py-2.5 text-[13px] outline-none"
      />
      <ul className="mt-4 flex-1 space-y-4">
        {recent.length === 0 ? (
          <li className="text-[13px] text-ink-soft">No notes yet. Capture one above.</li>
        ) : (
          recent.map((n) => (
            <li key={n.id}>
              <Link href="/jarvis/notepad" className="block">
                <p className="flex items-start justify-between gap-3 text-[14px] leading-snug">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-ink-soft" />
                    <span className="truncate">{n.title}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-soft">{relativeHours(n.updatedAt)}</span>
                </p>
                <p className="mt-1 line-clamp-2 pl-3.5 text-[12px] leading-relaxed text-ink-soft">
                  {n.body || "Empty"}
                </p>
              </Link>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

function relativeHours(ts: number) {
  const hours = Math.max(1, Math.round((Date.now() - ts) / 3600_000));
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}
