"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { StudioProduction, StudioShot } from "@/lib/studio-production";

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function drawMotif(
  ctx: CanvasRenderingContext2D,
  shot: StudioShot,
  w: number,
  h: number,
  t: number,
  seed: number,
) {
  const [c0, c1, accent] = shot.colors;
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, c0);
  g.addColorStop(1, c1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const zoom = lerp(1, 1.12, t);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-w / 2, -h / 2);

  ctx.strokeStyle = `${accent}55`;
  ctx.lineWidth = 1.2;
  if (shot.motif === "wide" || shot.motif === "scene") {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.62);
    for (let x = 0; x <= w; x += 8) {
      const y = h * 0.62 + Math.sin(x * 0.02 + seed) * 10;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.fillStyle = `${accent}18`;
    ctx.fillRect(w * 0.15, h * 0.28, w * 0.22, h * 0.28);
    ctx.fillRect(w * 0.62, h * 0.34, w * 0.18, h * 0.22);
  } else if (shot.motif === "product" || shot.motif === "closeup") {
    const cx = w / 2;
    const cy = h / 2 + Math.sin(t * Math.PI) * 8;
    ctx.fillStyle = `${accent}33`;
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.18, w * 0.22, h * 0.04, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = accent;
    const s = Math.min(w, h) * 0.18;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.18 + t * 0.08);
    ctx.fillRect(-s * 0.7, -s * 0.45, s * 1.4, s * 0.9);
    ctx.restore();
  } else if (shot.motif === "text" || shot.motif === "endcard") {
    ctx.fillStyle = `${accent}22`;
    ctx.fillRect(w * 0.12, h * 0.28, w * 0.76, h * 0.18);
    ctx.fillRect(w * 0.18, h * 0.52, w * 0.46, 6);
  } else if (shot.motif === "broll") {
    for (let i = 0; i < 7; i++) {
      const x = ((seed + i * 47) % 100) / 100;
      const y = ((seed + i * 91) % 100) / 100;
      ctx.fillStyle = `${accent}${i % 2 ? "44" : "22"}`;
      ctx.beginPath();
      ctx.arc(w * x, h * y, 18 + (i % 4) * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.strokeStyle = accent;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.46, Math.min(w, h) * 0.16, 0, Math.PI * 2 * Math.min(1, t + 0.2));
    ctx.stroke();
    ctx.fillStyle = `${accent}28`;
    ctx.fillRect(w * 0.28, h * 0.7, w * 0.44 * Math.max(0.2, t), 4);
  }
  ctx.restore();
}

export function StudioViewport({
  production,
  playing,
  onPlayingChange,
}: {
  production: StudioProduction | null;
  playing: boolean;
  onPlayingChange: (next: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(0);
  const [frame, setFrame] = useState(0);
  const shots = useMemo(() => production?.shots ?? [], [production]);
  const total = useMemo(() => shots.reduce((n, s) => n + s.durationMs, 0), [shots]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => setFrame((n) => n + 1));
    ro.observe(wrap);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!playing || !total) return;
    let raf = 0;
    let last = performance.now();
    let stopped = false;
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      setClock((c) => {
        const next = c + dt;
        if (next >= total) {
          stopped = true;
          return total;
        }
        return next;
      });
      if (stopped) onPlayingChange(false);
      else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total, onPlayingChange]);

  let acc = 0;
  let shot: StudioShot | null = shots[shots.length - 1] || null;
  let local = 1;
  let shotStart = Math.max(0, total - (shot?.durationMs || 0));
  for (const s of shots) {
    if (clock < acc + s.durationMs) {
      shot = s;
      local = (clock - acc) / s.durationMs;
      shotStart = acc;
      break;
    }
    acc += s.durationMs;
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = wrap.getBoundingClientRect();
    const w = Math.max(320, Math.floor(rect.width));
    const h = Math.max(180, Math.floor(rect.height));
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, w, h);

    const aspect = production?.aspect === "9:16" ? 9 / 16 : 16 / 9;
    let fw = w * 0.86;
    let fh = fw / aspect;
    if (fh > h * 0.78) {
      fh = h * 0.78;
      fw = fh * aspect;
    }
    const fx = (w - fw) / 2;
    const fy = (h - fh) / 2 - 8;

    ctx.fillStyle = "#000";
    ctx.fillRect(fx - 10, fy - 10, fw + 20, fh + 20);

    ctx.save();
    ctx.beginPath();
    ctx.rect(fx, fy, fw, fh);
    ctx.clip();
    if (shot) {
      ctx.translate(fx, fy);
      drawMotif(ctx, shot, fw, fh, local, shot.index * 17 + (production?.title.length || 0));
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(fx, fy, fw, fh);
      ctx.clip();
      const bar = fh * 0.18;
      const fade = ctx.createLinearGradient(0, fy + fh - bar, 0, fy + fh);
      fade.addColorStop(0, "rgba(0,0,0,0)");
      fade.addColorStop(1, "rgba(0,0,0,0.72)");
      ctx.fillStyle = fade;
      ctx.fillRect(fx, fy + fh - bar, fw, bar);
      ctx.fillStyle = "#f4efe6";
      ctx.font = `600 ${Math.max(13, fw * 0.032)}px ui-sans-serif, system-ui`;
      ctx.fillText(shot.title, fx + 16, fy + fh - 36);
      ctx.fillStyle = "rgba(244,239,230,0.72)";
      ctx.font = `${Math.max(11, fw * 0.022)}px ui-sans-serif, system-ui`;
      ctx.fillText(shot.caption.slice(0, 72), fx + 16, fy + fh - 16);
    } else {
      ctx.fillStyle = "#101318";
      ctx.fillRect(fx, fy, fw, fh);
      ctx.fillStyle = "rgba(244,239,230,0.45)";
      ctx.font = "13px ui-sans-serif, system-ui";
      ctx.fillText("Prompt a production to roll the first cut.", fx + 20, fy + fh / 2);
    }
    ctx.restore();

    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, w, fy);
    ctx.fillRect(0, fy + fh, w, h - (fy + fh));

    if (shot) {
      ctx.fillStyle = "#e0567a";
      ctx.beginPath();
      ctx.arc(fx + 16, fy + 18, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(244,239,230,0.7)";
      ctx.font = "10px ui-sans-serif, system-ui";
      ctx.fillText(playing ? "REC" : "HOLD", fx + 26, fy + 22);
      ctx.fillText(`${shot.index + 1}/${shots.length || 1}`, fx + fw - 48, fy + 22);
    }
  }, [production, shot, local, playing, shots.length, frame]);

  const progress = total ? clock / total : 0;

  return (
    <div className="flex h-full min-h-[320px] flex-col bg-[#07080c]">
      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="border-t border-white/10 px-4 py-3 text-white">
        <div className="mb-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (!shots.length) return;
              if (clock >= total) setClock(0);
              onPlayingChange(!playing);
            }}
            className="rounded-md border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white hover:bg-white/15 disabled:opacity-40"
            disabled={!shots.length}
          >
            {playing ? "Pause" : clock >= total && total ? "Replay" : "Play"}
          </button>
          <p className="min-w-0 truncate text-[11px] text-white/70">
            {production
              ? `${production.aspect} · ${production.runtimeSec}s · ${production.shots.length} shots · ${production.kind}`
              : "Empty slate"}
          </p>
        </div>
        <div className="relative h-2 overflow-hidden rounded-full bg-white/10">
          {shots.map((s) => {
            const start = shots.slice(0, s.index).reduce((n, x) => n + x.durationMs, 0);
            const left = total ? (start / total) * 100 : 0;
            const width = total ? (s.durationMs / total) * 100 : 0;
            return (
              <button
                key={s.id}
                type="button"
                title={s.title}
                onClick={() => {
                  setClock(start + 16);
                  onPlayingChange(true);
                }}
                className="absolute top-0 h-full border-r border-black/40"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  background: s.id === shot?.id ? s.colors[2] : `${s.colors[2]}55`,
                }}
              />
            );
          })}
          <div
            className="pointer-events-none absolute top-0 h-full w-px bg-white"
            style={{ left: `${progress * 100}%` }}
          />
        </div>
        <p className="mt-2 text-[10px] uppercase tracking-widest text-white/40">
          {shot ? `Shot ${shot.index + 1} · ${shot.title}` : "No shots"}
          {shotStart >= 0 && total ? ` · ${Math.round(clock / 1000)}s / ${Math.round(total / 1000)}s` : ""}
        </p>
      </div>
    </div>
  );
}
