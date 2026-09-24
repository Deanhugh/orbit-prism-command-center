"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { HeaderControls } from "@/components/chrome/HeaderControls";
import { PageNav } from "@/components/chrome/PageNav";
import { useRouter } from "next/navigation";
import { useOrbitInit } from "@/lib/use-orbit-init";
import type { GNode } from "./Brain3D";

const Brain3D = dynamic(() => import("./Brain3D"), { ssr: false });

const C = {
  bg: "#05080f",
  panel: "rgba(10,16,26,0.72)",
  line: "rgba(111,212,230,0.18)",
  text: "#c3d2e0",
  muted: "#61748a",
  dim: "#3d4b5c",
  accent: "#6fd4e6",
  amber: "#e0a94a",
};

interface Category { id: string; label: string; color: string }
interface BrainData { name: string; vaultConnected: boolean; categories: Category[]; nodes: GNode[]; edges: [string, string][] }

export function VaultPage() {
  useOrbitInit();
  const router = useRouter();

  const [data, setData] = useState<BrainData | null>(null);
  const [visibleCats, setVisibleCats] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<GNode | null>(null);
  const [noteBody, setNoteBody] = useState("");
  const [cinema, setCinema] = useState(false);
  const [spin, setSpin] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/brain-3d").then((r) => r.json()).then((d: BrainData) => {
        if (!alive) return;
        setData(d);
        setVisibleCats((prev) => (prev.size ? prev : new Set(d.categories.map((c) => c.id))));
      }).catch(() => {});
    load();
    const id = setInterval(load, 20000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const selExt = selected ? (selected.path.split(".").pop() || "").toLowerCase() : "";
  const selIsImage = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "avif"].includes(selExt);
  const selIsPdf = selExt === "pdf";
  const selIsText = ["md", "markdown", "mdx", "txt", "canvas"].includes(selExt);
  const selIsBinary = selected != null && !selIsText && !selIsImage && !selIsPdf;

  // load selected note body (text files only; media is previewed directly)
  useEffect(() => {
    if (!selected || !selIsText) return;
    let alive = true;
    fetch(`/api/brain?doc=${encodeURIComponent(selected.path)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setNoteBody(d.doc?.content || "(could not read note)"); })
      .catch(() => { if (alive) setNoteBody("(could not read note)"); });
    return () => { alive = false; };
  }, [selected, selIsText]);

  const selectNode = useCallback((n: GNode | null) => {
    setSelected(n);
    setNoteBody(n ? "Loading…" : "");
  }, []);

  // escape closes cinema / note reader
  useEffect(() => {
    function down(e: KeyboardEvent) {
      if (e.key === "Escape") { setCinema(false); setSelected(null); }
    }
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    data?.nodes.forEach((n) => { m[n.category] = (m[n.category] || 0) + 1; });
    return m;
  }, [data]);

  function toggleCat(id: string) {
    setVisibleCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function soloCat(id: string) { setVisibleCats(new Set([id])); }
  function allCats() { if (data) setVisibleCats(new Set(data.categories.map((c) => c.id))); }

  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }

  const total = data?.nodes.length ?? 0;

  return (
    <div className="relative h-screen w-screen overflow-hidden" style={{ background: C.bg, color: C.text, fontFamily: "var(--font-mono)" }}>
      <Brain3D
        nodes={data?.nodes ?? []}
        edges={data?.edges ?? []}
        visibleCats={visibleCats}
        query={query}
        revealed={null}
        selectedId={selected?.id ?? null}
        onSelect={(n) => selectNode(n)}
        cinema={cinema}
        spin={spin}
      />

      {/* header */}
      {!cinema && (
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-6 py-3">
          <div className="pointer-events-auto flex flex-wrap items-center gap-3">
            <div className="flex flex-col items-start leading-none">
              <Image
                src="/orbit-logo-white.png"
                alt="Orbit Prism"
                width={258}
                height={24}
                priority
                className="h-6 w-auto"
              />
              <span className="mt-1 pl-0.5 text-[8px] font-semibold uppercase tracking-[0.18em]" style={{ color: C.muted }}>
                Operating System Command Center
              </span>
            </div>
            <PageNav tone="dark" />
          </div>
          <div className="pointer-events-auto flex items-center gap-3">
            <HeaderControls tone="dark" showNav={false} />
            <button onClick={logout} className="text-[9px] tracking-[0.2em] hover:text-white" style={{ color: C.muted }}>SIGN OUT</button>
          </div>
        </header>
      )}

      {/* search */}
      {!cinema && (
        <div className="absolute left-1/2 top-16 z-20 w-[min(420px,80vw)] -translate-x-1/2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your brain…"
            className="w-full rounded-full px-4 py-2 text-center text-[12px] outline-none"
            style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}`, backdropFilter: "blur(8px)" }}
          />
        </div>
      )}

      {/* category legend */}
      {!cinema && data && (
        <div className="absolute bottom-4 left-4 z-20 rounded-lg p-3" style={{ background: C.panel, border: `1px solid ${C.line}`, backdropFilter: "blur(8px)" }}>
          <div className="mb-1.5 flex items-center justify-between gap-4">
            <span className="text-[9px] font-bold tracking-[0.25em]" style={{ color: "#8fa0b2" }}>CATEGORIES</span>
            <button onClick={allCats} className="text-[8px] tracking-[0.2em]" style={{ color: C.accent }}>ALL</button>
          </div>
          <div className="space-y-1">
            {data.categories.map((c) => {
              const on = visibleCats.has(c.id);
              const n = counts[c.id] || 0;
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <button onClick={() => toggleCat(c.id)} onDoubleClick={() => soloCat(c.id)} title="click toggle · double-click solo" className="flex items-center gap-1.5 text-[10px]" style={{ opacity: on ? 1 : 0.4 }}>
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    <span style={{ color: C.text }}>{c.label}</span>
                  </button>
                  <span className="ml-auto text-[9px] tabular-nums" style={{ color: C.muted }}>{n}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* bottom controls */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        <button onClick={() => setSpin((x) => !x)} className="rounded-full px-4 py-1.5 text-[10px] font-bold tracking-[0.2em]" style={{ background: C.panel, color: spin ? C.text : C.amber, border: `1px solid ${C.line}` }}>
          {spin ? "◐ ROTATING" : "⏸ PAUSED"}
        </button>
        <button onClick={() => setCinema((x) => !x)} className="rounded-full px-4 py-1.5 text-[10px] font-bold tracking-[0.2em]" style={{ background: C.panel, color: C.text, border: `1px solid ${C.line}` }}>
          {cinema ? "✕ EXIT CINEMA" : "CINEMA"}
        </button>
        {!cinema && (
          <span className="rounded-full px-3 py-1.5 text-[9px] tracking-[0.15em]" style={{ background: C.panel, color: C.muted, border: `1px solid ${C.line}` }}>
            {total} notes · {data?.edges.length ?? 0} links
          </span>
        )}
      </div>

      {cinema && (
        <div className="pointer-events-none absolute right-6 top-6 z-20 text-right">
          <p className="text-[10px] tracking-[0.3em]" style={{ color: C.muted }}>{data?.name?.toUpperCase()}</p>
          <p className="text-[40px] font-bold leading-none tabular-nums">{total}</p>
          <p className="text-[9px] tracking-[0.25em]" style={{ color: C.muted }}>NODES</p>
        </div>
      )}

      {/* note reader */}
      {selected && !cinema && (
        <div className="absolute right-4 top-16 z-30 w-[360px] rounded-lg p-4" style={{ background: "rgba(6,11,20,0.95)", border: `1px solid ${C.line}`, backdropFilter: "blur(10px)", maxHeight: "calc(100vh - 90px)", overflowY: "auto" }}>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-[13px] font-bold" style={{ color: C.text }}>{selected.title}</h3>
              <p className="text-[8px] tracking-[0.15em]" style={{ color: C.muted }}>{selected.path}</p>
            </div>
            <button onClick={() => selectNode(null)} style={{ color: C.muted }}>✕</button>
          </div>
          {selIsImage && (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={`/api/brain-file?path=${encodeURIComponent(selected.path)}`} alt={selected.title} className="w-full rounded" style={{ border: `1px solid ${C.line}` }} />
          )}
          {selIsPdf && (
            <div>
              <iframe src={`/api/brain-file?path=${encodeURIComponent(selected.path)}`} title={selected.title} className="h-[420px] w-full rounded" style={{ border: `1px solid ${C.line}` }} />
              <a href={`/api/brain-file?path=${encodeURIComponent(selected.path)}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[10px] tracking-[0.15em]" style={{ color: C.accent }}>OPEN PDF ↗</a>
            </div>
          )}
          {selIsText && (
            <pre className="whitespace-pre-wrap text-[11px] leading-relaxed" style={{ color: C.text, fontFamily: "var(--font-ui)" }}>{noteBody}</pre>
          )}
          {selIsBinary && (
            <p className="text-[11px]" style={{ color: C.muted }}>
              {selExt.toUpperCase()} file — <a href={`/api/brain-file?path=${encodeURIComponent(selected.path)}`} target="_blank" rel="noreferrer" style={{ color: C.accent }}>open ↗</a>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
