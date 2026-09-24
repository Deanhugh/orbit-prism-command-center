"use client";

import Link from "next/link";
import { ExternalLink, Pin } from "lucide-react";
import type { JarvisArticle } from "@/lib/jarvis-data";

export function DeckKnowledge({ articles }: { articles: JarvisArticle[] }) {
  const recent = [...articles].sort((a, b) => b.savedAt - a.savedAt).slice(0, 6);

  return (
    <section className="hud-panel p-4 lg:col-span-12">
      <div className="flex items-center justify-between gap-2">
        <p className="hud-label flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-ink-soft" />
          Knowledge
          <Pin size={10} className="opacity-50" />
        </p>
        <Link
          href="/jarvis/knowledge"
          className="text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
        >
          Browse
        </Link>
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-ink-soft">
        <span>{recent.length} recent</span>
        <Link
          href="/jarvis/knowledge"
          className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink"
        >
          Open
          <ExternalLink size={10} />
        </Link>
      </div>
      {recent.length === 0 ? (
        <p className="mt-6 text-[13px] text-ink-soft">
          Nothing saved yet. Open Knowledge to pin a URL to the deck.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {recent.map((a) => (
            <li key={a.id}>
              <a
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start justify-between gap-4 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] leading-snug">{a.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-x-3 text-[12px]">
                    <span className="text-[#4d8ef5]">{a.category}</span>
                    <span className="text-[#4d8ef5]">{hostOf(a.url)}</span>
                  </span>
                </span>
                <span className="shrink-0 pt-0.5 text-[11px] text-ink-soft">{relativeHours(a.savedAt)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function relativeHours(ts: number) {
  const hours = Math.max(1, Math.round((Date.now() - ts) / 3600_000));
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}
