"use client";

import dynamic from "next/dynamic";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { OfficeHeader } from "@/components/chrome/OfficeHeader";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { AGENTS } from "@/lib/office-data";
import { useSpaceToTalk, useVoice } from "@/lib/use-voice";
import type { DrawBoard, DrawJsonElement } from "@/lib/draw-scene";

const ExcalidrawCanvas = dynamic(
  () => import("./ExcalidrawCanvas").then((m) => m.ExcalidrawCanvas),
  { ssr: false, loading: () => <p className="p-6 text-[13px] text-ink-soft">Loading the board…</p> },
);

const PRESETS = [
  { label: "Flowchart", prompt: "Onboarding flowchart from signup to first value" },
  { label: "Architecture", prompt: "System architecture: client, API, and database" },
  { label: "Wireframe", prompt: "Login screen wireframe with email and submit" },
  { label: "Org chart", prompt: "Org chart for brand, content, and social" },
];

const CREW = AGENTS.filter((a) => ["mk_gfx", "mk_lead", "mk_social", "op_lead"].includes(a.id));

interface TranscriptLine {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
}

export function DrawStudio() {
  useOrbitInit();
  const [prompt, setPrompt] = useState("");
  const [agentId, setAgentId] = useState(CREW.find((a) => a.id === "mk_gfx")?.id || CREW[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [board, setBoard] = useState<DrawBoard | null>(null);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/draw")
      .then((r) => r.json())
      .then((d) => {
        if (d.current) {
          setBoard(d.current);
          setLines(
            (d.current.steps || []).map((s: { id: string; text: string }) => ({
              id: s.id,
              role: "agent" as const,
              text: s.text,
            })),
          );
        }
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  }, [lines, busy]);

  const agent = useMemo(() => CREW.find((a) => a.id === agentId) || CREW[0], [agentId]);
  const runRef = useRef<(text: string) => Promise<void>>(async () => undefined);

  async function run(nextPrompt: string) {
    const text = nextPrompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setLines((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text },
      { id: `sys_${Date.now()}`, role: "system", text: `${agent?.name || "Agent"} picked up the board.` },
    ]);
    try {
      const res = await fetch("/api/draw/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, agentId }),
      });
      const data = (await res.json()) as {
        error?: string;
        board?: DrawBoard;
        events?: { type: string; text?: string }[];
      };
      if (!res.ok || !data.board) throw new Error(data.error || `HTTP ${res.status}`);
      const nextLines: TranscriptLine[] = (data.events || [])
        .filter((e) => e.type === "step" && e.text)
        .map((e, i) => ({ id: `st_${Date.now()}_${i}`, role: "agent" as const, text: e.text || "" }));
      setLines((prev) => [...prev, ...nextLines]);
      setBoard(data.board);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }
  runRef.current = run;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = prompt;
    setPrompt("");
    void run(text);
  }

  const onVoice = useCallback((text: string) => {
    void runRef.current(text);
  }, []);
  const { supported: voiceSupported, listening, interim, start, stop } = useVoice(onVoice);
  useSpaceToTalk({ enabled: voiceSupported && !busy, listening, start, stop });

  const persist = useCallback(
    (elements: DrawJsonElement[], viewBackgroundColor: string) => {
      if (!board?.id) return;
      void fetch("/api/draw", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: board.id,
          elements,
          appState: { viewBackgroundColor },
        }),
      }).catch(() => undefined);
    },
    [board?.id],
  );

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-ink">
      <OfficeHeader title="Draw" subtitle="Whiteboard · Excalidraw" />

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <section className="flex min-h-0 flex-col border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Drawing agent</p>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink"
            >
              {CREW.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.role}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] text-ink-soft">{agent?.does}</p>
          </div>

          <div ref={logRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            {lines.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-ink-soft">
                Speak or type a diagram. The agent sketches boxes and arrows on the Excalidraw board. You can keep drawing by hand after that. Space starts the mic.
              </p>
            ) : null}
            {lines.map((line) => (
              <div key={line.id}>
                <p className="text-[9px] font-bold uppercase tracking-widest text-ink-soft">
                  {line.role === "user" ? "You" : line.role === "system" ? "Office" : agent?.name || "Agent"}
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-ink">{line.text}</p>
              </div>
            ))}
            {listening ? <p className="text-[11px] text-ops">Listening… {interim}</p> : null}
            {busy ? <p className="text-[11px] text-ops">Sketching…</p> : null}
            {error ? <p className="text-[12px] text-marketing">{error}</p> : null}
          </div>

          <div className="border-t border-line p-3">
            <div className="mb-2 flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => void run(p.prompt)}
                  className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-soft hover:text-ink"
                >
                  {p.label}
                </button>
              ))}
            </div>
            <form onSubmit={onSubmit} className="flex gap-2">
              <input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={listening ? interim || "Listening…" : "Describe the diagram…"}
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-ops"
              />
              {voiceSupported ? (
                <button
                  type="button"
                  onClick={() => (listening ? stop() : start())}
                  aria-label={listening ? "Stop voice" : "Start voice"}
                  className={`rounded-md border px-2 ${listening ? "border-ops bg-ops/10 text-ops" : "border-line text-ink-soft hover:text-ink"}`}
                >
                  <Mic className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40"
              >
                Draw
              </button>
            </form>
          </div>
        </section>

        <section className="relative min-h-[320px] bg-[#fffef8]">
          {board ? (
            <ExcalidrawCanvas
              sceneId={board.id}
              elements={board.elements}
              viewBackgroundColor={board.appState?.viewBackgroundColor || "#fffef8"}
              onPersist={persist}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8 text-[13px] text-ink-soft">
              Prompt a flowchart, architecture, or wireframe — or start drawing after the first sketch.
            </div>
          )}
          <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md border border-black/10 bg-white/80 px-3 py-2 text-[11px] text-ink-soft">
            <div className="font-semibold text-ink">{board?.title || "Empty board"}</div>
            <div>{board ? `${board.elements.length} marks · ${board.agentName}` : "Prompt a diagram to start"}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
