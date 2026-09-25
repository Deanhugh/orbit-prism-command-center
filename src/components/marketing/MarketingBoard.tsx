"use client";

import { useEffect, useMemo, useState } from "react";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { cn } from "@/lib/utils";
import { PageNav } from "@/components/chrome/PageNav";
import { Brand } from "@/components/chrome/Brand";

const STATES = ["DRAFT", "SCHEDULED", "PUBLISHED", "FAILED"] as const;
type PostState = (typeof STATES)[number];
const STATE_LABEL: Record<PostState, string> = { DRAFT: "Draft", SCHEDULED: "Scheduled", PUBLISHED: "Published", FAILED: "Failed" };
const STATE_COLOR: Record<PostState, string> = { DRAFT: "#928d82", SCHEDULED: "#1f6feb", PUBLISHED: "#35b26a", FAILED: "#d64550" };

interface SocialAccount { id: string; platform: string; handle: string; active: boolean }
interface Post { id: string; content: string; status: PostState; platforms: string[]; scheduledAt: string | null; author: string | null }
interface SocialStatus { mode: "live" | "mock"; baseUrl: string; appUrl?: string; hasKey: boolean; reachable?: boolean; reason?: string }
interface Summary { channels: number; activeChannels: number; totalPosts: number; byState: { state: PostState; label: string; count: number }[]; scheduledNext7: number }
interface SocialData { status: SocialStatus; summary: Summary; channels: SocialAccount[]; posts: Post[] }

type View = "platform" | "board";

function shortDate(d: string | null) {
  return d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—";
}

export function MarketingBoard() {
  useOrbitInit();
  const [data, setData] = useState<SocialData | null>(null);
  const [error, setError] = useState("");
  const [view, setView] = useState<View>("platform");
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  const load = () =>
    fetch("/api/social")
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { setData(d); setError(""); })
      .catch((e) => setError(String(e)));

  useEffect(() => { load(); }, []);
  useEffect(() => {
    const t = setInterval(() => { if (view === "board") load(); }, 8000);
    return () => clearInterval(t);
  }, [view]);

  const appUrl = data?.status.appUrl;

  // Advance: Draft -> Scheduled -> Published (the server defaults a schedule date)
  async function advance(post: Post) {
    const next: PostState | null = post.status === "DRAFT" ? "SCHEDULED" : post.status === "SCHEDULED" ? "PUBLISHED" : null;
    if (!next) return;
    setBusy(post.id);
    await fetch(`/api/social/posts/${post.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(null);
    load();
  }

  const byState = (s: PostState) => (data?.posts || []).filter((p) => p.status === s);

  return (
    <div className="min-h-screen w-screen overflow-y-auto bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/70 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Marketing</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Social scheduling · powered by TryPost</span>
          </div>
        </div>
      </header>

      <div className={cn("mx-auto px-6 py-4", view === "platform" ? "max-w-[1400px]" : "max-w-[1300px]")}>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-full border border-line bg-panel p-0.5">
            {(["platform", "board"] as View[]).map((v) => (
              <button key={v} onClick={() => setView(v)} className={cn("rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide", view === v ? "bg-ink text-canvas" : "text-ink-soft hover:text-ink")}>
                {v === "platform" ? "Platform" : "Calendar"}
              </button>
            ))}
          </div>
          <StatusPill status={data?.status} />
          {appUrl && (
            <a href={appUrl} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">
              Open in TryPost ↗
            </a>
          )}
          {view === "board" && (
            <button onClick={() => setShowAdd((v) => !v)} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">
              {showAdd ? "Close" : "+ New post"}
            </button>
          )}
        </div>

        {view === "platform" && (
          <PlatformEmbed appUrl={appUrl} live={data?.status.mode === "live" && data?.status.reachable !== false} onViewBoard={() => setView("board")} />
        )}

        {view === "board" && (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <Kpi label="Channels" value={data ? `${data.summary.activeChannels}/${data.summary.channels}` : "—"} />
              <Kpi label="Posts" value={data ? String(data.summary.totalPosts) : "—"} />
              <Kpi label="Next 7 days" value={data ? String(data.summary.scheduledNext7) : "—"} />
              {data && (
                <div className="flex items-center gap-1.5 rounded-lg border border-line bg-panel px-3 py-1.5 text-[11px] text-ink-soft">
                  {data.channels.map((c) => (
                    <span key={c.id} className={cn("rounded-full px-2 py-0.5", c.active ? "bg-canvas-2 text-ink" : "text-ink-soft line-through")}>{c.platform}</span>
                  ))}
                </div>
              )}
            </div>

            {showAdd && <AddPost channels={data?.channels || []} onCreated={() => { setShowAdd(false); load(); }} />}

            {error && (
              <div className="rounded-lg border border-line bg-panel p-6 text-center text-[12px] text-finance">
                Couldn&apos;t load posts: {error}
                <button onClick={load} className="ml-2 underline">retry</button>
              </div>
            )}
            {!data && !error && <div className="rounded-lg border border-line bg-panel p-10 text-center text-[12px] text-ink-soft">Loading calendar…</div>}

            {data && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {STATES.map((state) => {
                  const posts = byState(state);
                  return (
                    <div key={state} className="rounded-lg border border-line bg-panel/60">
                      <div className="flex items-center justify-between border-b border-line px-3 py-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATE_COLOR[state] }} />
                          {STATE_LABEL[state]}
                        </span>
                        <span className="text-[10px] text-ink-soft tabular-nums">{posts.length}</span>
                      </div>
                      <div className="space-y-2 p-2">
                        {posts.length === 0 && <p className="px-1 py-3 text-center text-[10px] text-ink-soft">—</p>}
                        {posts.map((p) => (
                          <div key={p.id} className={cn("rounded-md border border-line bg-canvas p-2.5", busy === p.id && "opacity-50")}>
                            <p className="text-[12px] leading-snug">{p.content}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              {p.platforms.map((pl) => (
                                <span key={pl} className="rounded-full bg-canvas-2 px-1.5 py-0.5 text-[9px] font-semibold text-ink-soft">{pl}</span>
                              ))}
                            </div>
                            <div className="mt-2 flex items-center justify-between">
                              <span className="text-[9px] text-ink-soft">{p.author || ""}{p.scheduledAt ? ` · ${shortDate(p.scheduledAt)}` : ""}</span>
                              {(state === "DRAFT" || state === "SCHEDULED") && (
                                <button onClick={() => advance(p)} className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">
                                  {state === "DRAFT" ? "Schedule ▶" : "Publish ▶"}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        <p className="mt-4 text-[10px] text-ink-soft">
          Posts are drafted, scheduled &amp; published via{" "}
          <a href="https://github.com/trypostit/trypost" className="underline" target="_blank" rel="noreferrer">TryPost</a>.
          The Social Media Strategist, Content Strategist &amp; Brand agents create and schedule these same posts when they run tasks.
          Connect your instance under Settings → Connectors → Marketing; until then this uses local mock posts.
        </p>
      </div>
    </div>
  );
}

function PlatformEmbed({ appUrl, live, onViewBoard }: { appUrl?: string; live?: boolean; onViewBoard: () => void }) {
  const src = useMemo(() => appUrl, [appUrl]);
  if (!live) {
    return (
      <div className="grid min-h-[60vh] place-items-center rounded-lg border border-dashed border-line bg-panel/60 p-8 text-center">
        <div className="max-w-[520px]">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-canvas-2 text-[20px]">📣</div>
          <h2 className="serif text-[16px] font-bold">Connect TryPost to load the full platform here</h2>
          <p className="mt-2 text-[12px] text-ink-soft">
            This tab embeds your real <span className="font-semibold text-ink">TryPost</span> workspace. It&apos;s empty right now
            because no instance is connected yet{src ? " (and TryPost&apos;s hosted cloud may block in-page embedding — a self-hosted TryPost embeds inline)" : ""}.
          </p>
          <p className="mt-2 text-[12px] text-ink-soft">
            Your Marketing agents can already use it via the API — you&apos;ll see their posts on the <span className="font-semibold text-ink">Calendar</span>.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <button onClick={onViewBoard} className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas">View the Calendar →</button>
            <a href="/jarvis/settings?tab=mcp" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink">Connect in Settings</a>
            {src && <a href={src} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2">Open in TryPost ↗</a>}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-ink-soft">
        <span>
          Showing your live <span className="font-semibold text-ink">TryPost</span> workspace.
          If the panel below stays blank, your instance blocks embedding —
        </span>
        <a href={src} target="_blank" rel="noreferrer" className="font-semibold text-ops underline">open it in a new tab ↗</a>
      </div>
      <div className="overflow-hidden rounded-lg border border-line bg-panel" style={{ height: "78vh" }}>
        <iframe src={src} title="TryPost" className="h-full w-full" referrerPolicy="no-referrer" sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads" />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className="text-ink-soft">{label}</span>{" "}
      <span className="font-bold tabular-nums">{value}</span>
    </div>
  );
}

function StatusPill({ status }: { status?: SocialStatus }) {
  if (!status) return null;
  const live = status.mode === "live" && status.reachable !== false;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-1.5 text-[12px]">
      <span className={cn("h-2 w-2 rounded-full", live ? "bg-emails" : status.mode === "live" ? "bg-finance" : "bg-sales")} />
      <span className="font-semibold">{status.mode === "live" ? "TryPost (live)" : "TryPost (mock)"}</span>
      {status.reason && <span className="text-[10px] text-ink-soft">{status.reason}</span>}
    </div>
  );
}

function AddPost({ channels, onCreated }: { channels: SocialAccount[]; onCreated: () => void }) {
  const [content, setContent] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [status, setStatus] = useState<PostState>("DRAFT");
  const [saving, setSaving] = useState(false);
  const options = Array.from(new Set(channels.map((c) => c.platform)));

  function toggle(p: string) {
    setPlatforms((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]));
  }

  async function create() {
    if (!content.trim()) return;
    setSaving(true);
    await fetch("/api/social", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: content.trim(), platforms, status }),
    });
    setSaving(false);
    setContent(""); setPlatforms([]); setStatus("DRAFT");
    onCreated();
  }

  return (
    <div className="mb-4 rounded-lg border border-line bg-panel p-3">
      <textarea placeholder="What do you want to post?" value={content} onChange={(e) => setContent(e.target.value)} rows={2} className="w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px]" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {options.map((p) => (
          <button key={p} onClick={() => toggle(p)} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", platforms.includes(p) ? "border-ink bg-ink text-canvas" : "border-line text-ink-soft hover:text-ink")}>{p}</button>
        ))}
        <select value={status} onChange={(e) => setStatus(e.target.value as PostState)} className="rounded-md border border-line bg-canvas px-2 py-1 text-[11px]">
          <option value="DRAFT">Draft</option>
          <option value="SCHEDULED">Schedule</option>
          <option value="PUBLISHED">Publish now</option>
        </select>
        <button onClick={create} disabled={!content.trim() || saving} className="ml-auto rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40">
          {saving ? "Saving…" : "Create post"}
        </button>
      </div>
    </div>
  );
}
