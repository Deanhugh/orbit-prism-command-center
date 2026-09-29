export type StudioKind =
  | "product"
  | "explainer"
  | "trailer"
  | "reel"
  | "talking-head"
  | "documentary"
  | "spot";

export type ShotMotif = "hook" | "product" | "scene" | "text" | "broll" | "closeup" | "wide" | "endcard";

export interface StudioShot {
  id: string;
  index: number;
  title: string;
  caption: string;
  durationMs: number;
  motif: ShotMotif;
  colors: [string, string, string];
}

export interface StudioProduction {
  id: string;
  title: string;
  logline: string;
  prompt: string;
  kind: StudioKind;
  aspect: "16:9" | "9:16";
  runtimeSec: number;
  agentId: string;
  agentName: string;
  agentRole: string;
  status: "building" | "ready" | "error";
  shots: StudioShot[];
  steps: { id: string; text: string }[];
  createdAt: number;
  updatedAt: number;
}

const PALETTES: Record<StudioKind, [string, string, string][]> = {
  product: [
    ["#0b1220", "#1a2744", "#c9a46a"],
    ["#14100c", "#3a2a18", "#e8d5b0"],
    ["#0e1614", "#1d3a32", "#8fd4b8"],
    ["#1a1020", "#3d2458", "#e0b0ff"],
    ["#101318", "#2a3344", "#f2f0ea"],
  ],
  explainer: [
    ["#0c1424", "#1d3a6e", "#7eb6ff"],
    ["#101820", "#24504a", "#8fe0c8"],
    ["#1a1428", "#4a2d7a", "#d4b8ff"],
    ["#18140c", "#5a4820", "#f0d48a"],
    ["#101418", "#2c3648", "#f4f1ea"],
  ],
  trailer: [
    ["#07080c", "#1a1024", "#e0567a"],
    ["#0a0c12", "#142038", "#4f8cff"],
    ["#100808", "#3a1810", "#f0a060"],
    ["#080c10", "#102828", "#40d0c0"],
    ["#0c0c10", "#22202c", "#f4efe6"],
  ],
  reel: [
    ["#12081a", "#4a1858", "#ff6ad5"],
    ["#0c1018", "#1a3860", "#5ad0ff"],
    ["#14100a", "#5a3810", "#ffc050"],
    ["#081410", "#145040", "#40e0a0"],
    ["#101014", "#2a2438", "#f6f2ea"],
  ],
  "talking-head": [
    ["#12161c", "#2a3344", "#d8c8a8"],
    ["#101418", "#243040", "#7aa8d4"],
    ["#16120e", "#3a2c20", "#e0c090"],
    ["#101614", "#243830", "#90c8b0"],
    ["#141418", "#2c2c34", "#f0ece4"],
  ],
  documentary: [
    ["#0e100c", "#2a2818", "#c8b070"],
    ["#101418", "#243040", "#8aa8c0"],
    ["#14100c", "#3a2418", "#d09060"],
    ["#0c1210", "#1a3028", "#70b090"],
    ["#121210", "#2c2c24", "#ece6d8"],
  ],
  spot: [
    ["#10141c", "#2a3858", "#e0567a"],
    ["#14100c", "#3a2a14", "#c98a3a"],
    ["#0c1418", "#1a3a48", "#4a9e6f"],
    ["#16101c", "#3a2460", "#8a6bd0"],
    ["#101214", "#2a3038", "#f2efe8"],
  ],
};

function hashPrompt(prompt: string): number {
  let h = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function topicFromPrompt(prompt: string): string {
  let cleaned = prompt
    .replace(/^(make|create|produce|build|shoot|film|cut|edit)\s+(me\s+)?(a|an|the)\s+/i, "")
    .replace(/\b\d+[-\s]?(second|sec|s)\b/gi, "")
    .replace(/\b(video|film|reel|trailer|spot|explainer|documentary|short|shorts|montage|commercial|cinematic|vertical|teaser|product)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 3; i++) {
    const next = cleaned.replace(/^(about|for|on|of|a|an|the)\s+/i, "").trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  cleaned = cleaned.replace(/^[:\-–—,.\s]+|[:\-–—,.\s]+$/g, "").trim();
  return cleaned.slice(0, 72) || "Orbit Prism";
}

function titleCase(text: string): string {
  return text
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ")
    .slice(0, 56);
}

function detectKind(q: string): StudioKind {
  if (/\b(reel|tiktok|short|shorts|vertical|ig story)\b/.test(q)) return "reel";
  if (/\b(trailer|cinematic|sci-?fi|teaser)\b/.test(q)) return "trailer";
  if (/\b(talking.?head|spokesperson|presenter|host)\b/.test(q)) return "talking-head";
  if (/\b(docu|documentary|history of|the story of)\b/.test(q)) return "documentary";
  if (/\b(explain|explainer|how .+ works|walkthrough)\b/.test(q)) return "explainer";
  if (/\b(product|hero still|sku|unbox|launch)\b/.test(q)) return "product";
  return "spot";
}

function shot(
  index: number,
  title: string,
  caption: string,
  durationMs: number,
  motif: ShotMotif,
  colors: [string, string, string],
): StudioShot {
  return { id: `sh_${index}`, index, title, caption, durationMs, motif, colors };
}

function palette(kind: StudioKind, seed: number): [string, string, string][] {
  const base = PALETTES[kind];
  const offset = seed % base.length;
  return base.map((_, i) => base[(i + offset) % base.length]);
}

function productShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "Cold open", `A still of ${topic} isolated on black.`, 3200, "hook", colors[0]),
    shot(1, "Hero lock", "First and last frame pinned to the approved still.", 4200, "product", colors[1]),
    shot(2, "Explode", "Hard-surface parts separate, then hold.", 4800, "closeup", colors[2]),
    shot(3, "Reassemble", "The object rebuilds into the same identity.", 4400, "product", colors[3]),
    shot(4, "End card", `${titleCase(topic)} · Orbit Prism Studio`, 3600, "endcard", colors[4]),
  ];
}

function explainerShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "Hook", `What if ${topic} was obvious in 45 seconds?`, 3000, "hook", colors[0]),
    shot(1, "Problem", "The mess before the system.", 3600, "scene", colors[1]),
    shot(2, "Mechanism", "Three beats: input, decision, output.", 4800, "text", colors[2]),
    shot(3, "Proof", "One concrete result on screen.", 4000, "broll", colors[3]),
    shot(4, "Ask", "What to do next, one line.", 3200, "endcard", colors[4]),
  ];
}

function trailerShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "Signal", `A pulse. Then ${topic}.`, 2400, "hook", colors[0]),
    shot(1, "World", "Wide establishing, low horizon.", 3600, "wide", colors[1]),
    shot(2, "Fracture", "The thing that breaks the calm.", 3200, "scene", colors[2]),
    shot(3, "Pursuit", "Cut on motion. No wasted frames.", 4000, "broll", colors[3]),
    shot(4, "Title", titleCase(topic).toUpperCase(), 3800, "endcard", colors[4]),
  ];
}

function reelShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "0.8s hook", `${titleCase(topic)} — stop scrolling.`, 1800, "hook", colors[0]),
    shot(1, "Pattern break", "Hard cut, new color, same promise.", 2200, "text", colors[1]),
    shot(2, "Proof clip", "One visual that does the talking.", 2800, "broll", colors[2]),
    shot(3, "Caption ride", "Word-level line over the beat.", 2600, "text", colors[3]),
    shot(4, "Loop out", "Last frame matches the first.", 2000, "endcard", colors[4]),
  ];
}

function talkingHeadShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "A-roll", `Host on ${topic}, eye-line locked.`, 4200, "closeup", colors[0]),
    shot(1, "Lower third", "Name, role, one claim.", 2800, "text", colors[1]),
    shot(2, "B-roll cover", "Cutaway while the point lands.", 3600, "broll", colors[2]),
    shot(3, "Return", "Back to camera for the close.", 3400, "closeup", colors[3]),
    shot(4, "Card", "CTA under the last line.", 2800, "endcard", colors[4]),
  ];
}

function documentaryShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "Thesis", `How ${topic} changed the map.`, 3600, "hook", colors[0]),
    shot(1, "Archive", "Still + slow push. Date in the corner.", 4400, "wide", colors[1]),
    shot(2, "Map", "A route draws itself.", 4000, "scene", colors[2]),
    shot(3, "Voice", "Narration over a single object.", 4200, "closeup", colors[3]),
    shot(4, "Close", "The word that remains.", 3400, "endcard", colors[4]),
  ];
}

function spotShots(topic: string, colors: [string, string, string][]): StudioShot[] {
  return [
    shot(0, "Open", `Hold on ${topic}.`, 2800, "hook", colors[0]),
    shot(1, "Offer", "What this is, in one sentence.", 3400, "text", colors[1]),
    shot(2, "Motion", "A short authored move, not a still.", 4000, "scene", colors[2]),
    shot(3, "Brand", "Look, type, and color lock.", 3200, "product", colors[3]),
    shot(4, "Out", "Studio slate. Ready for review.", 2800, "endcard", colors[4]),
  ];
}

function shotsFor(kind: StudioKind, topic: string, colors: [string, string, string][]): StudioShot[] {
  switch (kind) {
    case "product":
      return productShots(topic, colors);
    case "explainer":
      return explainerShots(topic, colors);
    case "trailer":
      return trailerShots(topic, colors);
    case "reel":
      return reelShots(topic, colors);
    case "talking-head":
      return talkingHeadShots(topic, colors);
    case "documentary":
      return documentaryShots(topic, colors);
    default:
      return spotShots(topic, colors);
  }
}

function loglineFor(kind: StudioKind, topic: string): string {
  switch (kind) {
    case "product":
      return `A product film that keeps ${topic} identical at first and last frame while the model invents the motion in between.`;
    case "explainer":
      return `A 45-second explainer that makes ${topic} obvious: hook, problem, mechanism, proof, ask.`;
    case "trailer":
      return `A cinematic teaser for ${topic} — signal, world, fracture, pursuit, title.`;
    case "reel":
      return `A vertical reel about ${topic} built to stop the thumb and loop.`;
    case "talking-head":
      return `A spokesperson cut on ${topic}: A-roll, lower third, cover, return, card.`;
    case "documentary":
      return `A short documentary beat about ${topic} — thesis, archive, map, voice, close.`;
    default:
      return `A branded studio spot about ${topic}, cut for review on the office floor.`;
  }
}

function stepsFor(kind: StudioKind, topic: string, shots: StudioShot[]): string[] {
  const runtime = Math.round(shots.reduce((n, s) => n + s.durationMs, 0) / 1000);
  return [
    `Reading the brief as a ${kind.replace("-", " ")} — not a still slideshow.`,
    `Locking the through-line on “${topic}” and a ${shots[0] ? (kind === "reel" ? "9:16" : "16:9") : "16:9"} frame.`,
    `Blocking ${shots.length} shots / ${runtime}s: ${shots.map((s) => s.title).join(" → ")}.`,
    "Writing captions and a review slate so you can play the cut on the right.",
    "Parking the production on /studio. This is the office cut — not a Veo/Kling render.",
  ];
}

export function productionForPrompt(prompt: string): {
  title: string;
  logline: string;
  kind: StudioKind;
  aspect: "16:9" | "9:16";
  shots: StudioShot[];
  steps: string[];
} {
  const q = prompt.toLowerCase();
  const kind = detectKind(q);
  const topic = topicFromPrompt(prompt);
  const colors = palette(kind, hashPrompt(prompt));
  const shots = shotsFor(kind, topic, colors);
  const aspect: "16:9" | "9:16" = kind === "reel" || /\b(vertical|9:16|portrait)\b/.test(q) ? "9:16" : "16:9";
  const title =
    kind === "trailer"
      ? titleCase(topic).toUpperCase()
      : kind === "product"
        ? `${titleCase(topic)} — product film`
        : `${titleCase(topic)} · ${kind.replace("-", " ")}`;
  return {
    title: title.slice(0, 64),
    logline: loglineFor(kind, topic),
    kind,
    aspect,
    shots,
    steps: stepsFor(kind, topic, shots),
  };
}

export function productionRuntimeSec(shots: StudioShot[]): number {
  return Math.max(1, Math.round(shots.reduce((n, s) => n + s.durationMs, 0) / 1000));
}
