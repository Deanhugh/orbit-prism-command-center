"use client";

import { useEffect, useRef, useState } from "react";
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import type { BrainNode } from "@/lib/types";
import { useOffice } from "@/lib/store";

interface SimNode extends SimulationNodeDatum, BrainNode {}

export function BrainGraphOverlay() {
  const open = useOffice((s) => s.brainOpen);
  const setOpen = useOffice((s) => s.setBrainOpen);
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<{ source: SimNode; target: SimNode }[]>([]);
  const [selected, setSelected] = useState<{ title: string; content: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const frame = useRef(0);
  const [, force] = useState(0);

  const W = 620;
  const H = 460;

  useEffect(() => {
    if (!open) return;
    let stop: (() => void) | null = null;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/brain");
        const data: { nodes: BrainNode[]; edges: [string, string][] } =
          await res.json();
        const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
        const byId = new Map(simNodes.map((n) => [n.id, n]));
        const simLinks = data.edges
          .map(([s, t]) => ({ source: byId.get(s)!, target: byId.get(t)! }))
          .filter((l) => l.source && l.target);
        const sim = forceSimulation<SimNode>(simNodes)
          .force("charge", forceManyBody().strength(-220))
          .force(
            "link",
            forceLink<SimNode, SimulationLinkDatum<SimNode>>(
              simLinks as unknown as SimulationLinkDatum<SimNode>[],
            )
              .id((d) => (d as SimNode).id)
              .distance(90),
          )
          .force("center", forceCenter(W / 2, H / 2));
        sim.on("tick", () => {
          frame.current++;
          if (frame.current % 2 === 0) force((x) => x + 1);
        });
        setNodes(simNodes);
        setLinks(simLinks);
        setLoading(false);
        const timer = setTimeout(() => sim.stop(), 4000);
        stop = () => {
          clearTimeout(timer);
          sim.stop();
        };
      } catch {
        setLoading(false);
      }
    };
    void load();
    return () => {
      if (stop) stop();
    };
  }, [open]);

  if (!open) return null;

  function openDoc(rel: string) {
    fetch(`/api/brain?doc=${encodeURIComponent(rel)}`)
      .then((r) => r.json())
      .then((d) => d.doc && setSelected({ title: d.doc.title, content: d.doc.content }));
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-ink/30 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative flex max-h-[86vh] w-[min(980px,92vw)] overflow-hidden rounded-xl border border-line bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 border-r border-line p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="serif text-[14px] font-bold text-ink">The Brain</h2>
            <span className="text-[10px] uppercase tracking-wide text-ink-soft">
              {nodes.length} notes · {links.length} links
            </span>
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="h-[460px]">
            {links.map((l, i) => (
              <line
                key={i}
                x1={l.source.x}
                y1={l.source.y}
                x2={l.target.x}
                y2={l.target.y}
                stroke="var(--color-line)"
                strokeWidth={1}
              />
            ))}
            {nodes.map((n) => (
              <g
                key={n.id}
                transform={`translate(${n.x ?? W / 2},${n.y ?? H / 2})`}
                className="cursor-pointer"
                onClick={() => openDoc(n.path)}
              >
                <circle
                  r={Math.max(6, n.size / 3)}
                  fill="var(--color-canvas-2)"
                  stroke="var(--color-finance)"
                  strokeWidth={1.5}
                />
                <text
                  y={-Math.max(6, n.size / 3) - 4}
                  textAnchor="middle"
                  className="serif"
                  fontSize={9}
                  fill="var(--color-ink)"
                >
                  {n.title}
                </text>
              </g>
            ))}
          </svg>
          {loading && (
            <p className="text-center text-[11px] text-ink-soft">Reading notes…</p>
          )}
        </div>

        <div className="w-[320px] overflow-y-auto p-4 thin-scroll">
          {selected ? (
            <>
              <button
                onClick={() => setSelected(null)}
                className="mb-2 text-[10px] uppercase tracking-wide text-ink-soft"
              >
                ← back
              </button>
              <h3 className="serif text-[13px] font-bold text-ink">
                {selected.title}
              </h3>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed text-ink">
                {selected.content}
              </pre>
            </>
          ) : (
            <div className="mt-6 text-center">
              <p className="serif text-[13px] text-ink">Your notes, as a graph</p>
              <p className="mt-1 text-[11px] text-ink-soft">
                Each note is a node; <code>[[wiki links]]</code> are the edges.
                Click a node to read it. Agents read the most relevant notes
                before every task.
              </p>
            </div>
          )}
        </div>

        <button
          onClick={() => setOpen(false)}
          className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full border border-line bg-canvas text-ink-soft hover:text-ink"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
