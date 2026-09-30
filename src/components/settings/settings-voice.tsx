"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { primeJarvisSpeech, speakJarvis, stopJarvisSpeech } from "@/lib/speak-jarvis";

const FISH_SITE = "https://fish.audio";
const FISH_KEYS = "https://fish.audio/app/api-keys";

function fishVoiceHref(id: string) {
  return `${FISH_SITE}/m/${encodeURIComponent(id)}/`;
}

interface FishVoice {
  id: string;
  title: string;
  description?: string;
  languages?: string[];
  tags?: string[];
  taskCount?: number;
}

interface VoiceCfg {
  referenceId: string;
  title: string;
  model: string;
}

interface VoiceStatus {
  hasKey: boolean;
  configured: boolean;
  voice: VoiceCfg;
  curated: FishVoice[];
  library: FishVoice[];
  libraryTotal?: number;
  libraryOk?: boolean;
  reason: string;
}

const PREVIEW = "Good morning. All systems nominal. I have the morning brief ready.";

export function VoiceSettings() {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function load(query?: string) {
    const q = query !== undefined ? query : search;
    const url = q.trim() ? `/api/jarvis/voice?search=${encodeURIComponent(q.trim())}` : "/api/jarvis/voice";
    const res = await fetch(url);
    const d = (await res.json()) as VoiceStatus;
    setStatus(d);
    return d;
  }

  useEffect(() => {
    void fetch("/api/jarvis/voice")
      .then((r) => r.json())
      .then((d: VoiceStatus) => setStatus(d))
      .catch(() => setNote({ ok: false, text: "Could not load voice settings." }));
  }, []);

  async function save(patch: Record<string, unknown>, okText: string) {
    setBusy("save");
    setNote(null);
    try {
      const res = await fetch("/api/jarvis/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = (await res.json()) as VoiceStatus;
      if (!res.ok) {
        setNote({ ok: false, text: "Could not save Fish voice settings." });
        return null;
      }
      setStatus(d);
      setNote({ ok: true, text: okText });
      return d;
    } catch {
      setNote({ ok: false, text: "Could not save Fish voice settings." });
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function saveKey() {
    const key = apiKey.trim();
    if (!key) {
      setNote({ ok: false, text: "Paste a Fish API key first." });
      return;
    }
    const d = await save({ apiKey: key }, "Fish API key saved.");
    if (d) setApiKey("");
  }

  async function pickVoice(voice: FishVoice) {
    primeJarvisSpeech();
    const d = await save(
      { referenceId: voice.id, title: voice.title },
      `Jarvis now uses ${voice.title}.`,
    );
    if (d?.hasKey) {
      speakJarvis(PREVIEW);
    }
  }

  async function saveModel(model: string) {
    await save({ model }, `Saved model ${model}.`);
  }

  async function runSearch() {
    setBusy("search");
    setNote(null);
    try {
      const d = await load(search);
      if (!d.hasKey) setNote({ ok: false, text: "Save a Fish API key to search the library." });
      else if (!d.library.length) setNote({ ok: false, text: "No library voices matched that search." });
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    primeJarvisSpeech();
    setNote({ ok: true, text: "Asking Fish Audio…" });
    const result = await speakJarvis(PREVIEW);
    if (result.source === "fish") {
      setNote({ ok: true, text: `Playing ${status?.voice.title || "the Fish library voice"}.` });
      return;
    }
    setNote({
      ok: false,
      text: result.reason
        ? `${result.reason} Preview used the browser voice instead.`
        : "Preview used the browser voice. Fish TTS did not return audio.",
    });
  }

  const selected = status?.voice.referenceId;
  const voices = mergeVoices(status?.curated || [], status?.library || []);

  return (
    <div className="mx-auto max-w-[900px] space-y-4">
      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", status?.hasKey ? "bg-emails" : "bg-finance")} />
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Jarvis voice · Fish Audio</h2>
          <span className="text-[10px] text-ink-soft">{status?.reason || "Loading…"}</span>
          <a
            href={FISH_SITE}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-line px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ops hover:bg-canvas-2"
          >
            Open Fish Audio
            <ExternalLink size={11} />
          </a>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">
          Morning Brief, Evening Wrap, and Today speak through a Fish Audio library voice — not the
          browser&apos;s default. Create a key at{" "}
          <a className="underline" href={FISH_KEYS} target="_blank" rel="noreferrer">
            fish.audio/app/api-keys
          </a>
          , paste it here (or set <code>FISH_API_KEY</code> on Railway), then pick a voice.{" "}
          <code>s2.1-pro</code> needs{" "}
          <a className="underline" href="https://fish.audio/app/developers" target="_blank" rel="noreferrer">
            Fish API credit
          </a>{" "}
          — that is separate from website credit. The free developer model is <code>s2.1-pro-free</code>. Browser speech stays as fallback if Fish is offline.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <label className="text-[9px] uppercase tracking-wide text-ink-soft">
              API key {status?.hasKey ? "(set)" : ""}
            </label>
            <div className="flex gap-1">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={status?.hasKey ? "•••• saved" : "FISH_API_KEY"}
                className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]"
              />
              <button
                type="button"
                onClick={() => void saveKey()}
                disabled={busy === "save"}
                className="rounded-md border border-line px-2 text-[10px] disabled:opacity-40"
              >
                {busy === "save" ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
          <div>
            <label className="text-[9px] uppercase tracking-wide text-ink-soft">TTS model</label>
            <select
              value={status?.voice.model || "s2.1-pro-free"}
              onChange={(e) => void saveModel(e.target.value)}
              className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]"
            >
              <option value="s2.1-pro-free">s2.1-pro-free (no API credit)</option>
              <option value="s2.1-pro">s2.1-pro (needs API credit)</option>
              <option value="s2-pro">s2-pro (needs API credit)</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={preview}
            className="rounded-md bg-ink px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-canvas"
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => stopJarvisSpeech()}
            className="rounded-md border border-line px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide"
          >
            Stop
          </button>
          <span className="text-[10px] text-ink-soft">
            Current: <strong className="text-ink">{status?.voice.title || "JARVIS"}</strong>
            {!status?.hasKey ? " · browser fallback until a key is saved" : ""}
          </span>
          {status?.voice.referenceId ? (
            <a
              href={fishVoiceHref(status.voice.referenceId)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ops hover:underline"
            >
              Open current voice
              <ExternalLink size={10} />
            </a>
          ) : null}
        </div>
        {note ? (
          <p className={cn("mt-2 text-[11px] font-medium", note.ok ? "text-emails" : "text-finance")}>{note.text}</p>
        ) : null}
      </section>

      <section className="rounded-lg border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[12px] font-bold uppercase tracking-widest text-ink-soft">Library</h2>
          <a
            href={FISH_SITE}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ops hover:underline"
          >
            Browse fish.audio
            <ExternalLink size={10} />
          </a>
        </div>
        <p className="mt-1 text-[11px] text-ink-soft">
          Starter voices are public Fish library models. Open any card on Fish Audio to hear the original, or search the rest of the English catalog after the key is saved.
        </p>
        <form
          className="mt-3 flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void runSearch();
          }}
        >
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Fish library (e.g. British, narrator, female)"
            className="w-full rounded-md border border-line bg-canvas px-2 py-1 text-[11px]"
          />
          <button
            type="submit"
            disabled={busy === "search"}
            className="rounded-md border border-line px-3 text-[10px] font-semibold uppercase disabled:opacity-40"
          >
            {busy === "search" ? "…" : "Search"}
          </button>
        </form>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {voices.map((v) => {
            const on = v.id === selected;
            return (
              <div
                key={v.id}
                className={cn(
                  "rounded-lg border px-3 py-2",
                  on ? "border-cyan bg-cyan/10" : "border-line",
                )}
              >
                <button
                  type="button"
                  onClick={() => void pickVoice(v)}
                  className="w-full text-left"
                >
                  <span className="block text-[12px] font-semibold">{v.title}</span>
                  {v.description ? <span className="mt-0.5 block text-[11px] text-ink-soft">{v.description}</span> : null}
                  {on ? <span className="mt-1 block text-[9px] uppercase tracking-wide text-cyan">Selected</span> : null}
                </button>
                <a
                  href={fishVoiceHref(v.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-ops hover:underline"
                >
                  Open on Fish Audio
                  <ExternalLink size={10} />
                </a>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[10px] text-ink-soft">
          Keys stay in <code>data/secrets.json</code> (gitignored) or Railway env. Voice choice is stored in{" "}
          <code>data/fish-voice.json</code>.
        </p>
      </section>
    </div>
  );
}

function mergeVoices(curated: FishVoice[], library: FishVoice[]): FishVoice[] {
  const seen = new Set<string>();
  const out: FishVoice[] = [];
  for (const v of [...curated, ...library]) {
    if (!v.id || seen.has(v.id)) continue;
    seen.add(v.id);
    out.push(v);
  }
  return out;
}
