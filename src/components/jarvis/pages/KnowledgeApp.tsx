"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useJarvisHub } from "../useJarvisHub";
import type { JarvisArticle } from "@/lib/jarvis-data";

export function KnowledgeApp() {
  const { hub, save } = useJarvisHub();
  const [category, setCategory] = useState("All");
  const [q, setQ] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [cat, setCat] = useState("Inbox");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const articles = hub?.articles ?? [];
  const cats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of articles) counts.set(a.category, (counts.get(a.category) || 0) + 1);
    return ["All", ...counts.keys()];
  }, [articles]);

  const shown = articles.filter((a) => {
    if (category !== "All" && a.category !== category) return false;
    if (!q.trim()) return true;
    const hay = `${a.title} ${a.note} ${a.url}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  async function saveArticle(e: React.FormEvent) {
    e.preventDefault();
    if (!hub) return;
    const href = url.trim();
    if (!href) {
      setError("Paste a URL to save.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const item: JarvisArticle = {
        id: `a_${Date.now().toString(36)}`,
        title: title.trim() || href.replace(/^https?:\/\//, "").slice(0, 60),
        url: href,
        category: cat.trim() || "Inbox",
        note: note.trim(),
        savedAt: Date.now(),
      };
      await save({ articles: [item, ...hub.articles] });
      setUrl("");
      setTitle("");
      setNote("");
    } catch {
      setError("Could not save that link.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 lg:flex-row">
      <aside className="w-full shrink-0 lg:w-48">
        <p className="hud-label px-2">Categories</p>
        <ul className="mt-2 space-y-1">
          {cats.map((c) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => setCategory(c)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-[13px]",
                  category === c ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink",
                )}
              >
                <span>{c}</span>
                <span className="text-[10px]">
                  {c === "All" ? articles.length : articles.filter((a) => a.category === c).length}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0 flex-1 space-y-3">
        <form onSubmit={saveArticle} className="hud-panel space-y-2 p-3">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a URL…"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional)"
              className="min-w-[160px] flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
            />
            <input
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              placeholder="Category"
              className="w-36 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-ink px-4 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional notes…"
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
          />
          {error ? <p className="text-[12px] text-marketing">{error}</p> : null}
        </form>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search saves…"
          className="w-full rounded-lg border border-line bg-panel px-3 py-2 text-[13px] outline-none"
        />
        {shown.length === 0 ? (
          <p className="py-10 text-center text-[13px] text-ink-soft">No saved pages in this view.</p>
        ) : (
          <ul className="space-y-2">
            {shown.map((a) => (
              <li key={a.id} className="hud-panel px-4 py-3">
                <a href={a.url} target="_blank" rel="noreferrer" className="text-[15px] font-medium hover:underline">
                  {a.title}
                </a>
                <p className="mt-1 text-[12px] text-ink-soft">{a.note || a.url}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-ink-soft">
                  <span className="rounded-full bg-canvas-2 px-2 py-0.5 text-emails">{a.category}</span>
                  <span>{a.url.replace(/^https?:\/\//, "").split("/")[0]}</span>
                  <span className="ml-auto">
                    {new Date(a.savedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
