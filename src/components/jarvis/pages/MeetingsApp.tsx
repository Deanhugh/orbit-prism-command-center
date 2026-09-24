"use client";

import { useState } from "react";
import { formatWhen, seedMeetings } from "@/lib/jarvis-data";

export function MeetingsApp() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const rows = seedMeetings().filter((m) => {
    if (!q.trim()) return true;
    return `${m.title} ${m.notes} ${m.attendees}`.toLowerCase().includes(q.toLowerCase());
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="hud-label">Meeting memory</p>
          <p className="mt-1 text-[12px] text-emails">{rows.length} notes connected</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search notes…"
          className="w-full max-w-xs rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none"
        />
      </div>
      <ul className="mt-6 space-y-2">
        {rows.length === 0 ? (
          <li className="py-10 text-center text-[13px] text-ink-soft">No meeting notes match.</li>
        ) : (
          rows.map((m) => (
            <li key={m.id} className="hud-panel">
              <button
                type="button"
                onClick={() => setOpen(open === m.id ? null : m.id)}
                className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
              >
                <div>
                  <p className="text-[15px] font-medium">{m.title}</p>
                  <p className="mt-1 text-[11px] text-ink-soft">
                    {formatWhen(m.when)} · {m.attendees}
                  </p>
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                  {open === m.id ? "Hide" : "View"}
                </span>
              </button>
              {open === m.id ? (
                <p className="border-t border-line px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
                  {m.notes}
                </p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
