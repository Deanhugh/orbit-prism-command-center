"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Brand } from "@/components/chrome/Brand";
import { PageNav } from "@/components/chrome/PageNav";
import { CadViewport } from "@/components/cad/CadViewport";
import { useOrbitInit } from "@/lib/use-orbit-init";
import { AGENTS } from "@/lib/office-data";
import type { CadModel, CadSolid } from "@/lib/cad-geometry";

const PRESETS = [
  { label: "Hilbert cube", prompt: "Level 3 Hilbert cube infill, 2 mm square bar" },
  { label: "L-bracket", prompt: "Aluminum L-bracket with mounting holes" },
  { label: "Enclosure", prompt: "Electronics enclosure with lid and cable port" },
  { label: "Flange", prompt: "Bolt flange with six holes" },
];

const ENGINEERS = AGENTS.filter((a) => a.dept === "ops");

interface TranscriptLine {
  id: string;
  role: "user" | "agent" | "system";
  text: string;
}

export function CadStudio() {
  useOrbitInit();
  const [prompt, setPrompt] = useState("");
  const [agentId, setAgentId] = useState(ENGINEERS.find((a) => a.id === "op_comply")?.id || ENGINEERS[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [model, setModel] = useState<CadModel | null>(null);
  const [solids, setSolids] = useState<CadSolid[]>([]);
  const [reveal, setReveal] = useState(0);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/cad")
      .then((r) => r.json())
      .then((d) => {
        if (d.current) {
          setModel(d.current);
          setSolids(d.current.solids || []);
          setReveal(d.current.solids?.length || 0);
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

  useEffect(() => {
    if (!solids.length || reveal >= solids.length) return;
    const id = window.setInterval(() => {
      setReveal((n) => Math.min(solids.length, n + Math.max(1, Math.ceil(solids.length / 48))));
    }, 28);
    return () => window.clearInterval(id);
  }, [solids, reveal]);

  const agent = useMemo(() => ENGINEERS.find((a) => a.id === agentId) || ENGINEERS[0], [agentId]);
  const building = busy || (solids.length > 0 && reveal < solids.length);

  async function run(nextPrompt: string) {
    const text = nextPrompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError("");
    setReveal(0);
    setSolids([]);
    setLines((prev) => [
      ...prev,
      { id: `u_${Date.now()}`, role: "user", text },
      { id: `sys_${Date.now()}`, role: "system", text: `${agent?.name || "Engineer"} picked up the brief.` },
    ]);
    try {
      const res = await fetch("/api/cad/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, agentId }),
      });
      const data = (await res.json()) as {
        error?: string;
        model?: CadModel;
        events?: { type: string; text?: string; agent?: { name: string; role: string }; solids?: CadSolid[] }[];
      };
      if (!res.ok || !data.model) throw new Error(data.error || `HTTP ${res.status}`);
      const nextLines: TranscriptLine[] = (data.events || [])
        .filter((e) => e.type === "step" && e.text)
        .map((e, i) => ({ id: `st_${Date.now()}_${i}`, role: "agent" as const, text: e.text || "" }));
      setLines((prev) => [...prev, ...nextLines]);
      setModel(data.model);
      setSolids(data.model.solids || []);
      setReveal(0);
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
            <h1 className="serif text-[15px] font-bold">CAD</h1>
            <span className="hidden text-[11px] text-ink-soft sm:inline">Text to part · Engineering studio</span>
          </div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(300px,400px)_1fr]">
        <section className="flex min-h-0 flex-col border-r border-line bg-panel">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-ink-soft">Engineering agent</p>
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              className="mt-1 w-full rounded-md border border-line bg-canvas px-2 py-1.5 text-[12px] text-ink"
            >
              {ENGINEERS.map((a) => (
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
                Prompt a part the way you would brief an engineer. The agent writes the build log here; the solid appears on the right as bars and plates go down.
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
            {building ? <p className="text-[11px] text-ops">Building — solids {reveal}/{solids.length || "…"}</p> : null}
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
                placeholder="Describe the part…"
                className="min-w-0 flex-1 rounded-md border border-line bg-canvas px-3 py-2 text-[13px] text-ink outline-none focus:border-ops"
              />
              <button
                type="submit"
                disabled={busy || !prompt.trim()}
                className="rounded-md bg-ink px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-canvas disabled:opacity-40"
              >
                Build
              </button>
            </form>
          </div>
        </section>

        <section className="relative min-h-[320px] bg-[#070b14]">
          <CadViewport solids={solids} reveal={reveal} />
          <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[11px] text-white/80">
            <div className="font-semibold text-white">{model?.title || "Empty scene"}</div>
            <div>{model ? `${model.solids.length} solids · ${model.agentName}` : "Prompt a part to start"}</div>
          </div>
        </section>
      </div>
    </div>
  );
}
