"use client";

import { useEffect, useRef } from "react";

export type JarvisMood = "idle" | "listening" | "thinking" | "speaking";

type Vec = { x: number; y: number; z: number };

function norm(v: Vec): Vec {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function mid(a: Vec, b: Vec): Vec {
  return norm({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
}

function icosphere(divs: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: Vec[] = [
    { x: -1, y: t, z: 0 },
    { x: 1, y: t, z: 0 },
    { x: -1, y: -t, z: 0 },
    { x: 1, y: -t, z: 0 },
    { x: 0, y: -1, z: t },
    { x: 0, y: 1, z: t },
    { x: 0, y: -1, z: -t },
    { x: 0, y: 1, z: -t },
    { x: t, y: 0, z: -1 },
    { x: t, y: 0, z: 1 },
    { x: -t, y: 0, z: -1 },
    { x: -t, y: 0, z: 1 },
  ].map(norm);
  let faces: [number, number, number][] = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ];
  for (let d = 0; d < divs; d++) {
    const cache = new Map<string, number>();
    const next: [number, number, number][] = [];
    const getMid = (a: number, b: number) => {
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      const i = verts.length;
      verts.push(mid(verts[a], verts[b]));
      cache.set(key, i);
      return i;
    };
    for (const [a, b, c] of faces) {
      const ab = getMid(a, b);
      const bc = getMid(b, c);
      const ca = getMid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    faces = next;
  }
  const edges: [number, number][] = [];
  const seen = new Set<string>();
  for (const [a, b, c] of faces) {
    for (const pair of [
      [a, b],
      [b, c],
      [c, a],
    ] as [number, number][]) {
      const i = Math.min(pair[0], pair[1]);
      const j = Math.max(pair[0], pair[1]);
      const k = `${i}-${j}`;
      if (!seen.has(k)) {
        seen.add(k);
        edges.push([i, j]);
      }
    }
  }
  return { verts, edges };
}

const MESH = icosphere(2);

const STARS = Array.from({ length: 56 }, (_, i) => {
  const n = Math.sin(i * 12.9898) * 43758.5453;
  const f = n - Math.floor(n);
  const n2 = Math.sin(i * 78.233) * 24634.931;
  const f2 = n2 - Math.floor(n2);
  return { x: f, y: f2, s: 0.4 + (f * f2) * 1.4, tw: 0.4 + f * 1.8 };
});

function rotY(p: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.z * s, y: p.y, z: p.x * s + p.z * c };
}

function rotX(p: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
}

function rotZ(p: Vec, a: number): Vec {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c, z: p.z };
}

/** Animated geodesic Jarvis core for the Today card. */
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
          ? 0.88 + Math.sin(t * 0.016) * 0.12
          : moodNow === "listening"
            ? 0.82 + Math.sin(t * 0.012) * 0.14
            : moodNow === "thinking"
              ? 0.8 + Math.sin(t * 0.022) * 0.18
              : 0.62 + Math.sin(t * 0.0038) * 0.1;
      const spinY = t * (moodNow === "thinking" ? 0.0009 : live ? 0.00048 : 0.00028);
      const spinX = 0.22 + Math.sin(t * 0.00018) * 0.04;
      const scale = Math.min(w, h) * 0.34;

      ctx.clearRect(0, 0, w, h);

      const field = ctx.createRadialGradient(cx, cy, 6, cx, cy, Math.max(w, h) * 0.62);
      field.addColorStop(0, `rgba(40, 150, 190, ${0.22 * pulse})`);
      field.addColorStop(0.45, `rgba(20, 70, 110, ${0.12 * pulse})`);
      field.addColorStop(1, "rgba(6, 12, 28, 0)");
      ctx.fillStyle = field;
      ctx.fillRect(0, 0, w, h);

      for (const star of STARS) {
        const tw = 0.25 + (0.75 * (Math.sin(t * 0.003 * star.tw + star.s) + 1)) / 2;
        ctx.fillStyle = `rgba(170, 230, 255, ${0.18 + 0.45 * tw * pulse})`;
        ctx.beginPath();
        ctx.arc(star.x * w, star.y * h, star.s, 0, Math.PI * 2);
        ctx.fill();
      }

      const project = (p: Vec) => {
        const r = rotY(rotX(p, spinX), spinY);
        const f = 2.4 / (2.7 + r.z);
        return { x: cx + r.x * scale * f, y: cy + r.y * scale * f, z: r.z, f };
      };

      const halo = ctx.createRadialGradient(cx, cy, scale * 0.2, cx, cy, scale * 1.35);
      halo.addColorStop(0, `rgba(90, 214, 255, ${0.16 * pulse})`);
      halo.addColorStop(1, "rgba(90, 214, 255, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 1.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.lineCap = "round";
      for (const [ia, ib] of MESH.edges) {
        const a = project(MESH.verts[ia]);
        const b = project(MESH.verts[ib]);
        const depth = (a.z + b.z) / 2;
        const alpha = (0.16 + (depth + 1) * 0.28) * pulse;
        ctx.strokeStyle = `rgba(90, 214, 255, ${alpha})`;
        ctx.lineWidth = depth > 0.15 ? 1.25 : 0.65;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.beginPath();
      ctx.arc(cx, cy, scale * 0.98, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(120, 230, 255, ${0.35 * pulse})`;
      ctx.lineWidth = 1.4;
      ctx.shadowColor = `rgba(90, 214, 255, ${0.7 * pulse})`;
      ctx.shadowBlur = 14;
      ctx.stroke();
      ctx.shadowBlur = 0;

      const scanY = cy + Math.sin(t * 0.0016) * scale * 0.72;
      const band = ctx.createLinearGradient(cx, scanY - 8, cx, scanY + 8);
      band.addColorStop(0, "rgba(90, 214, 255, 0)");
      band.addColorStop(0.5, `rgba(140, 240, 255, ${0.16 * pulse})`);
      band.addColorStop(1, "rgba(90, 214, 255, 0)");
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, scale * 0.96, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = band;
      ctx.fillRect(cx - scale, scanY - 8, scale * 2, 16);
      ctx.restore();

      const orbits = [
        { rx: 1.28, ry: 0.34, tilt: 0.55, speed: 0.00062, phase: 0 },
        { rx: 1.18, ry: 0.28, tilt: -0.72, speed: -0.00048, phase: 1.7 },
        { rx: 1.08, ry: 0.22, tilt: 1.15, speed: 0.00034, phase: 3.1 },
      ];
      for (const orbit of orbits) {
        ctx.beginPath();
        const steps = 72;
        for (let i = 0; i <= steps; i++) {
          const a = (i / steps) * Math.PI * 2 + t * orbit.speed;
          const p = project(
            rotZ(
              { x: Math.cos(a) * orbit.rx, y: Math.sin(a) * orbit.ry, z: Math.sin(a) * orbit.tilt * 0.35 },
              orbit.tilt,
            ),
          );
          if (i === 0) ctx.moveTo(p.x, p.y);
          else ctx.lineTo(p.x, p.y);
        }
        ctx.strokeStyle = `rgba(90, 214, 255, ${0.28 * pulse})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        const nodes = live ? 3 : 2;
        for (let n = 0; n < nodes; n++) {
          const a = t * orbit.speed * 2.4 + orbit.phase + (n * Math.PI * 2) / nodes;
          const p = project(
            rotZ(
              { x: Math.cos(a) * orbit.rx, y: Math.sin(a) * orbit.ry, z: Math.sin(a) * orbit.tilt * 0.35 },
              orbit.tilt,
            ),
          );
          const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 7);
          glow.addColorStop(0, `rgba(220, 250, 255, ${0.95 * pulse})`);
          glow.addColorStop(0.35, `rgba(90, 214, 255, ${0.7 * pulse})`);
          glow.addColorStop(1, "rgba(90, 214, 255, 0)");
          ctx.fillStyle = glow;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const baseY = h * 0.88;
      for (let i = 0; i < 4; i++) {
        const rx = 28 + i * 16;
        const ry = 5 + i * 2.2;
        ctx.beginPath();
        ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(70, 190, 230, ${(0.22 - i * 0.04) * pulse})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6 + i]);
        ctx.lineDashOffset = -t * 0.03 * (i % 2 === 0 ? 1 : -1);
        ctx.stroke();
        ctx.setLineDash([]);
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
      className="relative mx-auto flex h-[200px] w-[200px] shrink-0 flex-col items-center sm:h-[236px] sm:w-[236px]"
      role="img"
      aria-label={`Jarvis AI Core, ${label}`}
    >
      <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pt-1">
        <p className="serif text-[18px] font-semibold leading-none tracking-[0.22em] text-[#7eecff] drop-shadow-[0_0_12px_rgba(90,214,255,0.85)] sm:text-[22px]">
          JARVIS
        </p>
        <p className="mt-1.5 text-[8px] font-semibold uppercase tracking-[0.4em] text-[#7eecff]/80 sm:text-[9px]">
          AI Core
        </p>
      </div>
      <p className="pointer-events-none absolute bottom-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-cyan">
        {label}
      </p>
    </div>
  );
}
