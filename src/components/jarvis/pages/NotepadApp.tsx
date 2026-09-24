"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisHub } from "../useJarvisHub";
import type { JarvisNote } from "@/lib/jarvis-data";

export function NotepadApp() {
  const { hub, save } = useJarvisHub();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const notes = hub?.notes ?? [];
  const active = notes.find((n) => n.id === (activeId || notes[0]?.id)) || null;

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter((n) => `${n.title} ${n.body} ${n.project}`.toLowerCase().includes(q));
  }, [notes, filter]);

  async function update(patch: Partial<JarvisNote>) {
    if (!hub || !active) return;
    const next = hub.notes.map((n) => (n.id === active.id ? { ...n, ...patch, updatedAt: Date.now() } : n));
    await save({ notes: next });
  }

  async function create() {
    if (!hub) return;
    const note: JarvisNote = {
      id: `n_${Date.now().toString(36)}`,
      title: "Untitled",
      body: "",
      project: "",
      labels: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await save({ notes: [note, ...hub.notes] });
    setActiveId(note.id);
  }

  return (
    <div className="flex h-full min-h-[70vh]">
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-line bg-canvas-2">
        <div className="flex items-center gap-2 border-b border-line p-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 rounded-lg border border-line bg-panel px-2 py-1.5 text-[12px] outline-none"
          />
          <button
            type="button"
            onClick={create}
            className="grid h-8 w-8 place-items-center rounded-lg bg-finance text-canvas"
            aria-label="New note"
          >
            <Plus size={16} />
          </button>
        </div>
        <p className="hud-label px-3 pt-3">Library · {notes.length}</p>
        <ul className="min-h-0 flex-1 overflow-y-auto thin-scroll p-2">
          {shown.length === 0 ? (
            <li className="px-2 py-6 text-center text-[12px] text-ink-soft">No notes yet.</li>
          ) : (
            shown.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(n.id)}
                  className={cn(
                    "mb-1 w-full rounded-lg px-2 py-2 text-left",
                    active?.id === n.id ? "bg-panel" : "hover:bg-panel/60",
                  )}
                >
                  <p className="truncate text-[13px] font-medium">{n.title}</p>
                  <p className="truncate text-[11px] text-ink-soft">{n.body || "Empty"}</p>
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>
      <div className="min-w-0 flex-1 px-6 py-8 sm:px-12">
        {active ? (
          <>
            <input
              value={active.title}
              onChange={(e) => update({ title: e.target.value })}
              className="serif w-full bg-transparent text-[32px] font-bold outline-none"
            />
            <p className="mt-2 text-[11px] text-ink-soft">
              Edited {new Date(active.updatedAt).toLocaleString()} · Created{" "}
              {new Date(active.createdAt).toLocaleDateString()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={active.project}
                onChange={(e) => update({ project: e.target.value })}
                placeholder="Project"
                className="rounded-full border border-line bg-panel px-3 py-1 text-[11px] outline-none"
              />
              <input
                value={active.labels.join(", ")}
                onChange={(e) =>
                  update({
                    labels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                  })
                }
                placeholder="Labels"
                className="rounded-full border border-line bg-panel px-3 py-1 text-[11px] outline-none"
              />
            </div>
            <textarea
              value={active.body}
              onChange={(e) => update({ body: e.target.value })}
              placeholder="Write the brief Jarvis should remember…"
              className="mt-6 min-h-[50vh] w-full resize-none bg-transparent text-[15px] leading-7 outline-none"
            />
          </>
        ) : (
          <p className="text-[13px] text-ink-soft">Create a note to start the library.</p>
        )}
      </div>
    </div>
  );
}
