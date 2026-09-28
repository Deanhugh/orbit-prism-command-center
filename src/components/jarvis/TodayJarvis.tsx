"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoice } from "@/lib/use-voice";
import { JarvisCore, type JarvisMood } from "./JarvisCore";

interface Line {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const PRESETS = [
  { id: "morning", label: "Morning brief" },
  { id: "evening", label: "Evening wrap" },
  { id: "waiting", label: "Who is waiting" },
] as const;

export function TodayJarvis({
  greet,
  clock,
  greeting,
  jarvisLine,
  dateLabel,
  progress,
}: {
  greet: string;
  clock: string;
  greeting: string;
  jarvisLine: string;
  dateLabel: string;
  progress: number;
}) {
  const [messages, setMessages] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [voiceOut, setVoiceOut] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const voiceOutRef = useRef(false);

  useEffect(() => {
    voiceOutRef.current = voiceOut;
  }, [voiceOut]);

  const send = useCallback(async (text: string, preset?: string) => {
    const trimmed = (preset || text).trim();
    if (!trimmed || busyRef.current) return;
    busyRef.current = true;
    if (!preset) setInput("");
    setBusy(true);
    setError("");
    const optimistic: Line = {
      id: `local-${Date.now()}`,
      role: "user",
      content: preset ? PRESETS.find((p) => p.id === preset)?.label || text : text,
      ts: Date.now(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/jarvis/today-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(preset ? { preset } : { text }),
      });
      const data = (await res.json()) as { messages?: Line[]; error?: string };
      if (!res.ok) throw new Error(data.error || "Jarvis could not take that.");
      const next = data.messages || [];
      setMessages(next);
      const last = next.filter((l) => l.role === "assistant").at(-1);
      if (last && voiceOutRef.current) speakReply(last.content, setSpeaking);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jarvis could not take that.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const onVoice = useCallback(
    (text: string) => {
      void send(text);
    },
    [send],
  );
  const { supported: voiceSupported, listening, interim, start, stop } = useVoice(onVoice);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/jarvis/today-chat", { headers: { Accept: "application/json" } })
      .then(async (res) => {
        const data = (await res.json()) as { messages?: Line[] };
        if (!cancelled && Array.isArray(data.messages)) setMessages(data.messages);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, busy]);

  const mood: JarvisMood = listening
    ? "listening"
    : busy
      ? "thinking"
      : speaking
        ? "speaking"
        : "idle";

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const spokenLine = lastAssistant?.content || jarvisLine;

  return (
    <section
      id="today-jarvis"
      className="hud-panel hud-glow relative flex min-h-[360px] flex-col overflow-hidden p-5 lg:col-span-5 lg:min-h-[420px]"
    >
      <div className="hud-scan absolute inset-0 opacity-40" />
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div className="grid gap-3 sm:grid-cols-[1fr_minmax(160px,200px)] sm:items-start">
          <div className="min-w-0">
            <p className="hud-label flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emails" />
              Today · Jarvis
            </p>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.22em] text-ink-soft">
              Good {greet}
            </p>
            <p className="serif mt-6 text-[48px] font-semibold leading-none tabular-nums sm:mt-8 sm:text-[56px] lg:text-[64px]">
              {clock}
            </p>
            <p className="mt-4 text-[15px] text-ink">{greeting}</p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{spokenLine}</p>
            <div className="mt-6">
              <p className="text-[10px] uppercase tracking-[0.16em] text-ink-soft">{dateLabel}</p>
              <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-cyan"
                  style={{ width: `${Math.round(progress * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <JarvisCore mood={mood} />
        </div>

        <div className="mt-4 min-h-[72px] max-h-[112px] flex-1 space-y-2 overflow-y-auto thin-scroll pr-1">
          {messages.length === 0 ? (
            <p className="text-[12px] text-ink-soft">
              Talk to Jarvis in this box — type, or hold the mic. Ask for the brief, who is waiting, or
              what is next.
            </p>
          ) : (
            messages.slice(-8).map((line) => (
              <p
                key={line.id}
                className={cn(
                  "text-[12px] leading-relaxed",
                  line.role === "user" ? "text-ink" : "text-ink-soft",
                )}
              >
                <span className="hud-label mr-2">{line.role === "user" ? "You" : "Jarvis"}</span>
                {line.content}
              </p>
            ))
          )}
          {listening && interim ? (
            <p className="text-[12px] text-cyan">
              <span className="hud-label mr-2">You</span>
              {interim}
            </p>
          ) : null}
          {busy ? (
            <p className="text-[12px] text-ink-soft">
              <span className="hud-label mr-2">Jarvis</span>
              Working…
            </p>
          ) : null}
          <div ref={endRef} />
        </div>

        <div className="mt-3 flex flex-wrap gap-1">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={busy}
              onClick={() => void send(p.label, p.id)}
              className="rounded-full border border-line px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>

        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) void send(input.trim());
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tell Jarvis…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none placeholder:text-ink-soft/60"
          />
          <button
            type="button"
            onClick={() => setVoiceOut((v) => !v)}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full",
              voiceOut ? "bg-cyan text-canvas" : "text-ink-soft hover:text-ink",
            )}
            title={voiceOut ? "Voice replies on" : "Voice replies off"}
            aria-pressed={voiceOut}
          >
            {voiceOut ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          {voiceSupported ? (
            <button
              type="button"
              onMouseDown={start}
              onMouseUp={stop}
              onTouchStart={start}
              onTouchEnd={stop}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                listening ? "bg-finance text-white" : "text-ink-soft hover:text-ink",
              )}
              title="Hold to talk"
            >
              <Mic size={15} />
            </button>
          ) : null}
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-canvas disabled:opacity-40"
            title="Send"
          >
            <ArrowUp size={16} />
          </button>
        </form>
        {error ? <p className="mt-2 text-[12px] text-marketing">{error}</p> : null}
      </div>
    </section>
  );
}

function speakReply(text: string, setSpeaking: (v: boolean) => void) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  const clean = text.replace(/[#*_`>\-]/g, " ").slice(0, 500);
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = 1.04;
  u.pitch = 0.95;
  u.onstart = () => setSpeaking(true);
  u.onend = () => setSpeaking(false);
  u.onerror = () => setSpeaking(false);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
