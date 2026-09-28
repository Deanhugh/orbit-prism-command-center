"use client";

import { useEffect, useRef } from "react";

export type JarvisMood = "idle" | "listening" | "thinking" | "speaking";

/** Holographic Jarvis presence for the Today card. Original Orbit canvas — not MARK-1. */
export function JarvisCore({ mood }: { mood: JarvisMood }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const moodRef = useRef(mood);

  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let start = 0;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const draw = (ts: number) => {
      if (!start) start = ts;
      const t = ts - start;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const cx = w / 2;
      const cy = h * 0.46;
      const moodNow = moodRef.current;
      const live = moodNow !== "idle";
      const pulse =
        moodNow === "speaking"
          ? 0.82 + Math.sin(t * 0.014) * 0.18
          : moodNow === "listening"
            ? 0.78 + Math.sin(t * 0.01) * 0.16
            : moodNow === "thinking"
              ? 0.72 + Math.sin(t * 0.018) * 0.2
              : 0.55 + Math.sin(t * 0.0032) * 0.1;
      const spin = moodNow === "thinking" ? 0.0016 : live ? 0.0007 : 0.00028;

      ctx.clearRect(0, 0, w, h);

      const glow = ctx.createRadialGradient(cx, cy, 8, cx, cy, h * 0.48);
      glow.addColorStop(0, `rgba(104,188,211,${0.22 * pulse})`);
      glow.addColorStop(0.45, `rgba(104,188,211,${0.08 * pulse})`);
      glow.addColorStop(1, "rgba(10,5,20,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);

      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      ctx.clip();
      ctx.globalAlpha = 0.18 * pulse;
      ctx.strokeStyle = "rgba(104,188,211,0.55)";
      ctx.lineWidth = 1;
      const scan = ((t * 0.04) % (h + 24)) - 12;
      ctx.beginPath();
      ctx.moveTo(0, scan);
      ctx.lineTo(w, scan);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.restore();

      const rot = t * spin;
      for (let ring = 0; ring < 3; ring++) {
        const r = 62 - ring * 12;
        const segs = 10 + ring * 4;
        const dir = ring % 2 === 0 ? 1 : -1;
        ctx.strokeStyle = `rgba(104,188,211,${(0.42 - ring * 0.1) * pulse})`;
        ctx.lineWidth = 1.4 - ring * 0.25;
        for (let i = 0; i < segs; i++) {
          if (i % 3 === 0) continue;
          const a1 = (i / segs) * Math.PI * 2 + rot * dir;
          const a2 = a1 + (Math.PI * 2) / segs - 0.08;
          ctx.beginPath();
          ctx.arc(cx, cy + 18, r, a1, a2);
          ctx.stroke();
        }
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.shadowColor = `rgba(104,188,211,${0.65 * pulse})`;
      ctx.shadowBlur = 18;

      ctx.fillStyle = `rgba(180,236,248,${0.16 + 0.12 * pulse})`;
      ctx.strokeStyle = `rgba(180,236,248,${0.55 * pulse})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(0, -36, 18, 22, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-6, -16);
      ctx.lineTo(-4, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(6, -16);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-28, 8);
      ctx.quadraticCurveTo(-22, -4, -8, -4);
      ctx.lineTo(8, -4);
      ctx.quadraticCurveTo(22, -4, 28, 8);
      ctx.lineTo(22, 46);
      ctx.quadraticCurveTo(0, 56, -22, 46);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.shadowBlur = 0;
      ctx.fillStyle = `rgba(244,252,255,${0.35 + 0.4 * pulse})`;
      ctx.beginPath();
      ctx.arc(-6, -40, 2.2, 0, Math.PI * 2);
      ctx.arc(6, -40, 2.2, 0, Math.PI * 2);
      ctx.fill();

      const coreR = moodNow === "speaking" ? 7 + Math.sin(t * 0.02) * 2 : 6.5;
      const core = ctx.createRadialGradient(0, 14, 0, 0, 14, coreR * 2.2);
      core.addColorStop(0, `rgba(255,255,255,${0.95 * pulse})`);
      core.addColorStop(0.35, `rgba(104,188,211,${0.9 * pulse})`);
      core.addColorStop(1, "rgba(104,188,211,0)");
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(0, 14, coreR * 2.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      const baseY = h - 22;
      ctx.strokeStyle = `rgba(104,188,211,${0.35 * pulse})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, baseY, 48, 8, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = `rgba(104,188,211,${0.08 * pulse})`;
      ctx.fill();

      if (live) {
        const n = moodNow === "speaking" ? 7 : 5;
        for (let i = 0; i < n; i++) {
          const x = cx - 18 + i * 6;
          const amp =
            moodNow === "speaking"
              ? 6 + Math.abs(Math.sin(t * 0.02 + i)) * 10
              : 4 + Math.abs(Math.sin(t * 0.01 + i * 0.7)) * 5;
          ctx.strokeStyle = `rgba(104,188,211,${0.7 * pulse})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x, baseY - amp / 2);
          ctx.lineTo(x, baseY + amp / 2);
          ctx.stroke();
        }
      }

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  const label =
    mood === "listening"
      ? "Listening"
      : mood === "thinking"
        ? "Thinking"
        : mood === "speaking"
          ? "Speaking"
          : "Online";

  return (
    <div
      className="relative mx-auto flex h-[220px] w-[180px] shrink-0 flex-col items-center sm:h-[240px] sm:w-[196px]"
      role="img"
      aria-label={`Jarvis ${label}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <p className="pointer-events-none absolute bottom-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan">
        {label}
      </p>
    </div>
  );
}
