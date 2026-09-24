"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Line {
  id: string;
  role: "you" | "jarvis" | "sys";
  text: string;
  ts: number;
}

interface Status {
  url: string;
  running: boolean;
  paired: boolean;
  lastError: string;
  lines: Line[];
  error?: string;
}

export function SidecarToday() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pin, setPin] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await fetch("/api/jarvis/sidecar");
    const data = (await res.json()) as Status;
    if (!res.ok) {
      setError(data.error || "Could not reach the sidecar.");
      return;
    }
    setStatus(data);
    setError("");
  }

  useEffect(() => {
    load().catch(() => setError("Could not reach the sidecar."));
    const id = window.setInterval(() => {
      load().catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [status?.lines.length]);

  async function pair(e: React.FormEvent) {
    e.preventDefault();
    setBusy("pair");
    setError("");
    try {
      const res = await fetch("/api/jarvis/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pair", pin }),
      });
      const data = (await res.json()) as Status;
      if (!res.ok) throw new Error(data.error || "Pairing failed.");
      setStatus(data);
      setPin("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pairing failed.");
    } finally {
      setBusy("");
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setBusy("send");
    setError("");
    try {
      const res = await fetch("/api/jarvis/sidecar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "command", text: draft }),
      });
      const data = (await res.json()) as Status;
      if (!res.ok) throw new Error(data.error || "Mark-LIV did not take that.");
      setStatus(data);
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setBusy("");
    }
  }

  const running = Boolean(status?.running);
  const paired = Boolean(status?.paired);
  const label = !status
    ? "Checking…"
    : !running
      ? "Sidecar offline"
      : paired
        ? "Mark-LIV live"
        : "Needs pairing";

  return (
    <div className="mt-3 flex min-h-[220px] flex-col">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              paired ? "bg-emails" : running ? "bg-finance" : "bg-ink-soft",
            )}
          />
          {label}
        </p>
        <Link href="/jarvis/settings?tab=sidecar" className="text-[10px] uppercase tracking-wide text-ink-soft hover:text-ink">
          Sidecar settings
        </Link>
      </div>

      {!running ? (
        <p className="mt-3 text-[13px] leading-relaxed text-ink-soft">
          Mark-LIV is not running on this Mac. Start that Python app, wait until its dashboard is
          up on {status?.url || "http://127.0.0.1:8000"}, then pair with the Remote Control key.
          Jarvis in this box only speaks through that sidecar — desktop voice, wake word, and
          system control stay there.
        </p>
      ) : null}

      {running && !paired ? (
        <form onSubmit={pair} className="mt-3 space-y-2">
          <p className="text-[13px] leading-relaxed text-ink-soft">
            Mark-LIV is up. In that app, open <span className="text-ink">Remote Control</span> and
            type the one-time key here.
          </p>
          <div className="flex gap-2">
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              placeholder="ABC123"
              autoComplete="one-time-code"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 font-mono text-[13px] uppercase outline-none"
            />
            <button
              type="submit"
              disabled={busy === "pair"}
              className="rounded-full bg-ink px-3 py-2 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
            >
              {busy === "pair" ? "Pairing…" : "Pair"}
            </button>
          </div>
        </form>
      ) : null}

      {paired ? (
        <>
          <div className="mt-3 max-h-40 min-h-[88px] flex-1 space-y-2 overflow-y-auto thin-scroll pr-1">
            {(status?.lines || []).length === 0 ? (
              <p className="text-[13px] text-ink-soft">
                Jarvis is listening through Mark-LIV. Ask for a status, a reminder, or a desktop action.
              </p>
            ) : (
              (status?.lines || []).map((line) => (
                <p
                  key={line.id}
                  className={cn(
                    "text-[13px] leading-relaxed",
                    line.role === "you" && "text-ink",
                    line.role === "jarvis" && "text-ink",
                    line.role === "sys" && "text-ink-soft",
                  )}
                >
                  <span className="hud-label mr-2">
                    {line.role === "you" ? "You" : line.role === "jarvis" ? "Jarvis" : "Sidecar"}
                  </span>
                  {line.text}
                </p>
              ))
            )}
            <div ref={endRef} />
          </div>
          <form onSubmit={send} className="mt-3 flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Tell Jarvis…"
              className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-[13px] outline-none"
            />
            <button
              type="submit"
              disabled={busy === "send"}
              className="rounded-full bg-ink px-3 py-2 text-[11px] font-bold uppercase text-canvas disabled:opacity-50"
            >
              {busy === "send" ? "…" : "Send"}
            </button>
          </form>
        </>
      ) : null}

      {error ? <p className="mt-2 text-[12px] text-marketing">{error}</p> : null}
    </div>
  );
}
