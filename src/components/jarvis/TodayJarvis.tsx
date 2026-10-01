"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Mic, Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { useJarvisDictation, useRegisterJarvisDictation, TODAY_CHAT_EVENT } from "@/components/jarvis/JarvisDictation";
import { jarvisSpeechSupported, primeJarvisSpeech, speakJarvis, stopJarvisSpeech } from "@/lib/speak-jarvis";
import { JarvisCore, type JarvisMood } from "./JarvisCore";
import { notifyHubChanged } from "@/lib/jarvis-events";
import type { JarvisHub } from "@/lib/jarvis-data";

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
  const [voiceOut, setVoiceOut] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [speechOk, setSpeechOk] = useState(true);
  const router = useRouter();
  const endRef = useRef<HTMLDivElement>(null);
  const busyRef = useRef(false);
  const voiceOutRef = useRef(true);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setSpeechOk(jarvisSpeechSupported());
      try {
        const saved = localStorage.getItem("jarvis-voice-out");
        if (saved === "off") {
          setVoiceOut(false);
          voiceOutRef.current = false;
        }
      } catch {
        /* ignore */
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    voiceOutRef.current = voiceOut;
  }, [voiceOut]);

  const setSpeaker = useCallback((on: boolean) => {
    setVoiceOut(on);
    voiceOutRef.current = on;
    try {
      localStorage.setItem("jarvis-voice-out", on ? "on" : "off");
    } catch {
      /* ignore */
    }
    if (on) primeJarvisSpeech();
    else stopJarvisSpeech();
  }, []);

  const send = useCallback(async (text: string, preset?: string) => {
    const trimmed = (preset || text).trim();
    if (!trimmed || busyRef.current) return;
    if (preset) setSpeaker(true);
    else if (voiceOutRef.current) primeJarvisSpeech();
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
      const data = (await res.json()) as { messages?: Line[]; error?: string; hub?: JarvisHub; open?: string };
      if (!res.ok) throw new Error(data.error || "Jarvis could not take that.");
      const next = data.messages || [];
      setMessages(next);
      if (data.hub) notifyHubChanged(data.hub);
      if (data.open === "/draw") router.push("/draw");
      const last = next.filter((l) => l.role === "assistant").at(-1);
      if (last && voiceOutRef.current) {
        speakJarvis(last.content, {
          onStart: () => setSpeaking(true),
          onEnd: () => setSpeaking(false),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jarvis could not take that.");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [router, setSpeaker]);

  const onVoice = useCallback(
    (text: string) => {
      void send(text);
    },
    [send],
  );
  useRegisterJarvisDictation(onVoice);
  const { supported: voiceSupported, listening, interim, error: voiceError, start, stop } = useJarvisDictation();

  useEffect(() => {
    let cancelled = false;
    function load() {
      fetch("/api/jarvis/today-chat", { headers: { Accept: "application/json" } })
        .then(async (res) => {
          const data = (await res.json()) as { messages?: Line[] };
          if (!cancelled && Array.isArray(data.messages)) setMessages(data.messages);
        })
        .catch(() => {});
    }
    load();
    const id = window.setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener(TODAY_CHAT_EVENT, onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener(TODAY_CHAT_EVENT, onFocus);
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

  return (
    <section
      id="today-jarvis"
      className="hud-panel hud-glow relative flex min-h-[400px] flex-col overflow-hidden p-5 lg:col-span-5 lg:min-h-[460px]"
    >
      <div className="hud-scan absolute inset-0 opacity-40" />
      <div className="pointer-events-none absolute -right-2 top-1 z-[1] sm:right-1 sm:top-2">
        <JarvisCore mood={mood} />
      </div>
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col">
        <div className="min-w-0 pr-[148px] sm:pr-[200px]">
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
            <p className="mt-2 text-[12px] leading-relaxed text-ink-soft">{jarvisLine}</p>
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

        <div className="mt-4 min-h-[72px] max-h-[120px] flex-1 space-y-2 overflow-y-auto border-t border-line/70 pt-3 thin-scroll pr-1">
          {messages.length === 0 ? (
            <p className="text-[12px] text-ink-soft">
              Talk or type. Calendar, tasks, habits, goals, and reminders land on the dashboard.
              Desk work — CAD, Studio, CRM, PMO, Finance, a post — gets assigned to a desk.
            </p>
          ) : (
            messages.slice(-6).map((line) => (
              <p
                key={line.id}
                className={cn(
                  "text-[12px] leading-relaxed",
                  line.role === "user" ? "text-ink" : "text-ink-soft",
                )}
              >
                <span className="hud-label mr-2">{line.role === "user" ? "You" : "Jarvis"}</span>
                {displayLine(line)}
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
            placeholder="Tell Jarvis what to do…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none placeholder:text-ink-soft/60"
          />
          <button
            type="button"
            onClick={() => setSpeaker(!voiceOut)}
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center rounded-full",
              voiceOut ? "bg-cyan text-canvas" : "text-ink-soft hover:text-ink",
            )}
            title={
              !speechOk
                ? "This browser cannot speak. Use Chrome, Edge, or Safari."
                : voiceOut
                  ? "Speakers on — Jarvis reads briefs aloud"
                  : "Speakers off — click to hear Jarvis"
            }
            aria-pressed={voiceOut}
          >
            {voiceOut ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          {voiceSupported ? (
            <button
              type="button"
              onClick={() => (listening ? stop() : start())}
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-full",
                listening ? "bg-finance text-white" : "text-ink-soft hover:text-ink",
              )}
              title={listening ? "Stop listening (Space)" : "Talk to Jarvis (Space)"}
              aria-pressed={listening}
            >
              <Mic size={15} />
            </button>
          ) : (
            <p className="text-[10px] text-ink-soft">Voice needs Chrome, Edge, or Safari.</p>
          )}
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
        {voiceError ? <p className="mt-2 text-[12px] text-marketing">{voiceError}</p> : null}
        {!speechOk ? (
          <p className="mt-2 text-[11px] text-ink-soft">Voice out needs Chrome, Edge, or Safari — and the speakers unmuted.</p>
        ) : null}
      </div>
    </section>
  );
}

function displayLine(line: Line) {
  const text = line.content;
  if (line.role !== "user") return text;
  if (/morning brief/i.test(text)) return "Morning brief";
  if (/evening wrap/i.test(text)) return "Evening wrap";
  if (/who is waiting/i.test(text)) return "Who is waiting?";
  return text;
}
