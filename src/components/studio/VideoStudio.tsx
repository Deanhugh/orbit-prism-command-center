"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/chrome/Brand";
import { PageNav } from "@/components/chrome/PageNav";
import { StudioViewport } from "@/components/studio/StudioViewport";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { AGENTS } from "@/lib/office-data";
import type { StudioProduction } from "@/lib/studio-production";

const PRESETS = [
  { label: "Product film", prompt: "30-second product film for the new aluminum enclosure" },
  { label: "Explainer", prompt: "45-second explainer of how Orbit Prism routes work to agents" },
  { label: "Trailer", prompt: "Cinematic trailer about a signal from tomorrow" },
  { label: "Reel", prompt: "Vertical reel: stop scrolling, three beats, loop out" },
];

const CREW = AGENTS.filter((a) => a.id === "mk_gfx" || a.id === "mk_lead" || a.id === "mk_social");

interface TranscriptLine {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
}

export function VideoStudio() {
  useOrbitInit();
  const [prompt, setPrompt] = useState("");
  const [agentId, setAgentId] = useState(CREW.find((a) => a.id === "mk_gfx")?.id || CREW[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState<StudioProduction | null>(null);
  const [playing, setPlaying] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/studio")
      .then((r) => r.json())
      .then((d) => {
        if (d.current) {
          setModel(d.current);
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

  async function run(nextPrompt: string) {
    const text = nextPrompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setPlaying(false);
    setLines((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text },
      { id: `sys_${Date.now()}`, role: "system", text: `${agent?.name || "Studio"} picked up the brief.` },
    ]);
    try {
      const res = await fetch("/api/studio/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, agentId }),
      });
      const data = (await res.json()) as {
        error?: string;
        model?: StudioProduction;
        events?: { type: string; text?: string }[];
      };
      if (!res.ok || !data.model) throw new Error(data.error || `HTTP ${res.status}`);
      const nextLines: TranscriptLine[] = (data.events || [])
        .filter((e) => e.type === "step" && e.text)
        .map((e, i) => ({ id: `st_${Date.now()}_${i}`, role: "agent" as const, text: e.text || "" }));
      setLines((prev) => [...prev, ...nextLines]);
      setModel(data.model);
      setPlaying(true);
    } catch (e) {
      setError(String(e).replace(/^Error:\s*/, ""));
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const text = prompt;
    setPrompt("");
    void run(text);
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas text-ink">
      <header className="flex items-center justify-between border-b border-line bg-panel/80 px-6 py-3">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <Brand />
          <PageNav />
          <div className="flex items-baseline gap-3">
            <h1 className="serif text-[15px] font-bold">Studio</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Text to cut · Video production</span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <section className="flex min-h-0 flex-col border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Studio agent</p>
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
                Brief a reel, product film, explainer, or trailer. The agent writes the cut here; the right-hand slate
                plays the shot list. This is the office production desk — not a vendored OpenMontage pipeline.
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
            {busy ? <p className="text-[11px] text-ops">Cutting the slate…</p> : null}
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
                placeholder="Describe the film…"
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-marketing"
              />
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40"
              >
                Produce
              </button>
            </form>
          </div>
        </section>

        <section className="relative min-h-[320px] bg-[#07080c]">
          <StudioViewport
            key={model?.id || "empty"}
            production={model}
            playing={playing}
            onPlayingChange={setPlaying}
          />
          <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80">
            <div className="font-semibold text-white">{model?.title || "Empty slate"}</div>
            <div>
              {model
                ? `${model.shots.length} shots · ${model.runtimeSec}s · ${model.agentName}`
                : "Prompt a production to start"}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
