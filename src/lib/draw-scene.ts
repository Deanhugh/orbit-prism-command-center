/** Procedural Excalidraw scene from a text prompt — same idea as CAD solids. */

export interface DrawJsonElement {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  strokeColor: string;
  backgroundColor: string;
  fillStyle: "hachure" | "solid";
  strokeWidth: number;
  strokeStyle: "solid";
  roughness: number;
  opacity: number;
  groupIds: string[];
  frameId: null;
  roundness: { type: number } | null;
  seed: number;
  version: number;
  versionNonce: number;
  index: string;
  isDeleted: boolean;
  boundElements: { id: string; type: "arrow" | "text" }[] | null;
  updated: number;
  link: null;
  locked: boolean;
  [key: string]: unknown;
}

export interface DrawBoard {
  id: string;
  title: string;
  prompt: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  status: "ready";
  elements: DrawJsonElement[];
  appState: { viewBackgroundColor: string };
  steps: { id: string; text: string }[];
  createdAt: number;
  updatedAt: number;
}

const INK = "#1e1e1e";
const PAPER = "#fffef8";
const FILLS = ["#a5d8ff", "#ffec99", "#ffc9c9", "#b2f2bb", "#d0bfff", "#ffd8a8"];

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function titleFrom(prompt: string): string {
  const t = prompt.replace(/\s+/g, " ").trim();
  if (t.length <= 48) return t || "Untitled board";
  return `${t.slice(0, 45)}…`;
}

function words(prompt: string): string[] {
  const stop = new Set([
    "a", "an", "the", "and", "or", "of", "to", "for", "on", "in", "with", "from",
    "draw", "sketch", "whiteboard", "diagram", "flowchart", "flow", "chart",
    "wireframe", "architecture", "system", "please", "make", "create", "me",
    "an", "our", "my", "this", "that", "showing", "show", "using", "excalidraw",
  ]);
  const raw = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stop.has(w));
  const out: string[] = [];
  for (const w of raw) {
    const label = w.replace(/-/g, " ");
    if (!out.includes(label)) out.push(label);
    if (out.length >= 8) break;
  }
  return out.length ? out : ["idea", "step", "result"];
}

function kindOf(prompt: string): "architecture" | "flow" | "org" | "wire" | "mind" | "board" {
  const t = prompt.toLowerCase();
  if (/\b(wireframe|mockup|login|landing|screen|ui|form)\b/.test(t)) return "wire";
  if (/\b(org|org chart|team|reporting|hierarchy)\b/.test(t)) return "org";
  if (/\b(mind ?map|brainstorm|ideas?)\b/.test(t)) return "mind";
  if (/\b(arch|stack|system|client|api|database|service|microservice)\b/.test(t)) return "architecture";
  if (/\b(flow|flowchart|flow chart|process|pipeline|funnel|steps?|journey)\b/.test(t)) return "flow";
  return "board";
}

function frac(i: number): string {
  return `a${i.toString(36)}`;
}

function base(
  id: string,
  type: string,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  i: number,
  extra: Record<string, unknown> = {},
): DrawJsonElement {
  return {
    id,
    type,
    x,
    y,
    width: w,
    height: h,
    angle: 0,
    strokeColor: INK,
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 1,
    opacity: 100,
    groupIds: [],
    frameId: null,
    roundness: type === "text" || type === "arrow" ? null : { type: 3 },
    seed,
    version: 1,
    versionNonce: seed + i,
    index: frac(i),
    isDeleted: false,
    boundElements: null,
    updated: 1,
    link: null,
    locked: false,
    ...extra,
  };
}

function box(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  seed: number,
  i: number,
): DrawJsonElement {
  return base(id, "rectangle", x, y, w, h, seed, i, {
    backgroundColor: fill,
    fillStyle: "hachure",
  });
}

function label(
  id: string,
  containerId: string,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  seed: number,
  i: number,
): DrawJsonElement {
  const t = text.slice(0, 42);
  return base(id, "text", x + 8, y + h / 2 - 12, Math.max(40, w - 16), 24, seed, i, {
    text: t,
    originalText: t,
    fontSize: 18,
    fontFamily: 1,
    textAlign: "center",
    verticalAlign: "middle",
    containerId,
    autoResize: true,
    lineHeight: 1.25,
    baseline: 18,
  });
}

function arrow(
  id: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
  startId: string,
  endId: string,
  seed: number,
  i: number,
): DrawJsonElement {
  return base(id, "arrow", x, y, Math.abs(dx) || 1, Math.abs(dy) || 1, seed, i, {
    points: [
      [0, 0],
      [dx, dy],
    ],
    lastCommittedPoint: null,
    startBinding: { elementId: startId, focus: 0, gap: 4, fixedPoint: null },
    endBinding: { elementId: endId, focus: 0, gap: 4, fixedPoint: null },
    startArrowhead: null,
    endArrowhead: "arrow",
    elbowed: false,
  });
}

function heading(id: string, text: string, x: number, y: number, seed: number, i: number): DrawJsonElement {
  const t = text.slice(0, 64);
  return base(id, "text", x, y, Math.max(160, t.length * 12), 32, seed, i, {
    text: t,
    originalText: t,
    fontSize: 28,
    fontFamily: 1,
    textAlign: "left",
    verticalAlign: "top",
    containerId: null,
    autoResize: true,
    lineHeight: 1.25,
    baseline: 26,
  });
}

function bindText(boxEl: DrawJsonElement, textId: string) {
  boxEl.boundElements = [...(boxEl.boundElements || []), { id: textId, type: "text" }];
}

function bindArrow(boxEl: DrawJsonElement, arrowId: string) {
  boxEl.boundElements = [...(boxEl.boundElements || []), { id: arrowId, type: "arrow" }];
}

export function sceneForPrompt(prompt: string): {
  title: string;
  elements: DrawJsonElement[];
  steps: string[];
} {
  const title = titleFrom(prompt);
  const seed = hash(prompt) || 1;
  const labels = words(prompt);
  const kind = kindOf(prompt);
  const elements: DrawJsonElement[] = [];
  let n = 0;
  const next = () => n++;

  elements.push(heading(`t_${seed}`, title, 40, 24, seed, next()));

  if (kind === "wire") {
    const screen = box(`s_${seed}`, 80, 90, 520, 360, "#fff", seed, next());
    elements.push(screen);
    const chrome = box(`c_${seed}`, 80, 90, 520, 48, FILLS[0], seed, next());
    const chromeTxt = label(`ct_${seed}`, chrome.id, "Header", 80, 90, 520, 48, seed, next());
    bindText(chrome, chromeTxt.id);
    elements.push(chrome, chromeTxt);
    const field = box(`f_${seed}`, 160, 200, 360, 48, "#fff", seed, next());
    const fieldTxt = label(`ft_${seed}`, field.id, labels[0] || "input", 160, 200, 360, 48, seed, next());
    bindText(field, fieldTxt.id);
    elements.push(field, fieldTxt);
    const btn = box(`b_${seed}`, 250, 280, 180, 48, FILLS[1], seed, seed + next());
    const btnTxt = label(`bt_${seed}`, btn.id, labels[1] || "submit", 250, 280, 180, 48, seed, next());
    bindText(btn, btnTxt.id);
    elements.push(btn, btnTxt);
    return {
      title,
      elements,
      steps: ["Laid out a screen frame.", "Added header, field, and action."],
    };
  }

  if (kind === "org") {
    const nodes = labels.slice(0, 4);
    while (nodes.length < 3) nodes.push(`role ${nodes.length + 1}`);
    const top = box(`o0_${seed}`, 260, 90, 200, 72, FILLS[0], seed, next());
    const topTxt = label(`ot0_${seed}`, top.id, nodes[0], 260, 90, 200, 72, seed, next());
    bindText(top, topTxt.id);
    elements.push(top, topTxt);
    const kids = nodes.slice(1, 4);
    kids.forEach((name, i) => {
      const x = 80 + i * 220;
      const el = box(`o${i + 1}_${seed}`, x, 240, 180, 72, FILLS[(i + 1) % FILLS.length], seed, next());
      const tx = label(`ot${i + 1}_${seed}`, el.id, name, x, 240, 180, 72, seed, next());
      bindText(el, tx.id);
      const ar = arrow(`oa${i}_${seed}`, 360, 162, x + 90 - 360, 78, top.id, el.id, seed, next());
      bindArrow(top, ar.id);
      bindArrow(el, ar.id);
      elements.push(el, tx, ar);
    });
    return { title, elements, steps: ["Placed the lead.", "Dropped reporting lines."] };
  }

  if (kind === "mind") {
    const hub = box(`m0_${seed}`, 300, 200, 180, 80, FILLS[4], seed, next());
    const hubTxt = label(`mt0_${seed}`, hub.id, labels[0] || "center", 300, 200, 180, 80, seed, next());
    bindText(hub, hubTxt.id);
    elements.push(hub, hubTxt);
    const spokes = labels.slice(1, 6);
    const spots = [
      [80, 80],
      [520, 80],
      [80, 340],
      [520, 340],
      [300, 400],
    ];
    spokes.forEach((name, i) => {
      const [x, y] = spots[i] || [80 + i * 40, 80];
      const el = box(`m${i + 1}_${seed}`, x, y, 160, 64, FILLS[(i + 1) % FILLS.length], seed, next());
      const tx = label(`mt${i + 1}_${seed}`, el.id, name, x, y, 160, 64, seed, next());
      bindText(el, tx.id);
      const ar = arrow(`ma${i}_${seed}`, 390, 240, x + 80 - 390, y + 32 - 240, hub.id, el.id, seed, next());
      bindArrow(hub, ar.id);
      bindArrow(el, ar.id);
      elements.push(el, tx, ar);
    });
    return { title, elements, steps: ["Pinned the center.", "Radiated supporting ideas."] };
  }

  if (kind === "architecture") {
    const layers = labels.slice(0, 4);
    while (layers.length < 3) layers.push(["client", "api", "data"][layers.length] || "service");
    layers.forEach((name, i) => {
      const x = 80 + i * 200;
      const el = box(`a${i}_${seed}`, x, 180, 160, 80, FILLS[i % FILLS.length], seed, next());
      const tx = label(`at${i}_${seed}`, el.id, name, x, 180, 160, 80, seed, next());
      bindText(el, tx.id);
      elements.push(el, tx);
      if (i > 0) {
        const prevId = `a${i - 1}_${seed}`;
        const ar = arrow(`aa${i}_${seed}`, x - 40, 220, 40, 0, prevId, el.id, seed, next());
        const prev = elements.find((e) => e.id === prevId);
        if (prev) bindArrow(prev, ar.id);
        bindArrow(el, ar.id);
        elements.push(ar);
      }
    });
    return { title, elements, steps: ["Stacked the system boxes.", "Wired the request path."] };
  }

  const nodes = labels.slice(0, 5);
  while (nodes.length < 3) nodes.push(`step ${nodes.length + 1}`);
  nodes.forEach((name, i) => {
    const x = 60 + (i % 3) * 220;
    const y = 120 + Math.floor(i / 3) * 160;
    const el = box(`n${i}_${seed}`, x, y, 180, 80, FILLS[i % FILLS.length], seed, next());
    const tx = label(`nt${i}_${seed}`, el.id, name, x, y, 180, 80, seed, next());
    bindText(el, tx.id);
    elements.push(el, tx);
    if (i > 0) {
      const prevId = `n${i - 1}_${seed}`;
      const px = 60 + ((i - 1) % 3) * 220;
      const py = 120 + Math.floor((i - 1) / 3) * 160;
      const ar = arrow(
        `na${i}_${seed}`,
        px + 180,
        py + 40,
        x - (px + 180),
        y + 40 - (py + 40),
        prevId,
        el.id,
        seed,
        next(),
      );
      const prev = elements.find((e) => e.id === prevId);
      if (prev) bindArrow(prev, ar.id);
      bindArrow(el, ar.id);
      elements.push(ar);
    }
  });
  return {
    title,
    elements,
    steps: [
      kind === "flow" ? "Mapped the flow boxes." : "Dropped labeled cards on the board.",
      "Connected the sequence.",
    ],
  };
}

export const DRAW_PAPER = PAPER;
