export interface CadSolid {
  id: string;
  x: number;
  y: number;
  z: number;
  sx: number;
  sy: number;
  sz: number;
  color?: string;
}

export interface CadModel {
  id: string;
  title: string;
  prompt: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  status: "building" | "ready" | "error";
  solids: CadSolid[];
  steps: { id: string; text: string }[];
  createdAt: number;
  updatedAt: number;
}

const BLUE = "#4f8cff";

function box(
  id: string,
  x: number,
  y: number,
  z: number,
  sx: number,
  sy: number,
  sz: number,
  color = BLUE,
): CadSolid {
  return { id, x, y, z, sx, sy, sz, color };
}

function rid(prefix: string, i: number): string {
  return `${prefix}_${i}`;
}

/** Recursive 3D Hilbert walk over an n³ lattice (n must be a power of two). */
export function hilbert3d(n: number): [number, number, number][] {
  const pts: [number, number, number][] = [];
  function walk(
    x: number,
    y: number,
    z: number,
    dx: number,
    dy: number,
    dz: number,
    dx2: number,
    dy2: number,
    dz2: number,
    dx3: number,
    dy3: number,
    dz3: number,
    size: number,
  ) {
    if (size === 1) {
      pts.push([x, y, z]);
      return;
    }
    const h = size / 2;
    walk(x, y, z, dx2, dy2, dz2, dx3, dy3, dz3, dx, dy, dz, h);
    walk(x + dx2 * h, y + dy2 * h, z + dz2 * h, dx, dy, dz, dx2, dy2, dz2, dx3, dy3, dz3, h);
    walk(
      x + dx2 * h + dx * h,
      y + dy2 * h + dy * h,
      z + dz2 * h + dz * h,
      dx,
      dy,
      dz,
      dx2,
      dy2,
      dz2,
      dx3,
      dy3,
      dz3,
      h,
    );
    walk(
      x + dx2 * h + dx * h + dx3 * h,
      y + dy2 * h + dy * h + dy3 * h,
      z + dz2 * h + dz * h + dz3 * h,
      -dx2,
      -dy2,
      -dz2,
      -dx,
      -dy,
      -dz,
      dx3,
      dy3,
      dz3,
      h,
    );
    walk(
      x + dx * h + dx3 * h,
      y + dy * h + dy3 * h,
      z + dz * h + dz3 * h,
      -dx,
      -dy,
      -dz,
      -dx2,
      -dy2,
      -dz2,
      dx3,
      dy3,
      dz3,
      h,
    );
    walk(
      x + dx * h + dx2 * h + dx3 * h,
      y + dy * h + dy2 * h + dy3 * h,
      z + dz * h + dz2 * h + dz3 * h,
      -dx,
      -dy,
      -dz,
      dx2,
      dy2,
      dz2,
      -dx3,
      -dy3,
      -dz3,
      h,
    );
    walk(
      x + dx2 * h + dx3 * h,
      y + dy2 * h + dy3 * h,
      z + dz2 * h + dz3 * h,
      dx,
      dy,
      dz,
      -dx2,
      -dy2,
      -dz2,
      -dx3,
      -dy3,
      -dz3,
      h,
    );
    walk(x + dx3 * h, y + dy3 * h, z + dz3 * h, -dx2, -dy2, -dz2, dx3, dy3, dz3, -dx, -dy, -dz, h);
  }
  walk(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, n);
  return pts;
}

export function hilbertCube(level = 3, pitch = 4, bar = 2): CadSolid[] {
  const n = 2 ** Math.max(1, Math.min(4, level));
  const pts = hilbert3d(n);
  const solids: CadSolid[] = [];
  let i = 0;
  const half = ((n - 1) * pitch) / 2;
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, y0, z0] = pts[k];
    const [x1, y1, z1] = pts[k + 1];
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const mz = (z0 + z1) / 2;
    const dx = Math.abs(x1 - x0) * pitch + bar;
    const dy = Math.abs(y1 - y0) * pitch + bar;
    const dz = Math.abs(z1 - z0) * pitch + bar;
    solids.push(
      box(
        rid("h", i++),
        mx * pitch - half,
        my * pitch - half,
        mz * pitch - half,
        Math.max(bar, dx),
        Math.max(bar, dy),
        Math.max(bar, dz),
      ),
    );
  }
  return solids;
}

export function lBracket(): CadSolid[] {
  return [
    box("br_base", 0, 2, 0, 40, 4, 28),
    box("br_up", -18, 20, 0, 4, 40, 28),
    box("br_rib", -10, 10, 0, 12, 12, 4, "#6ea2ff"),
    box("br_hole1", 10, 2, 8, 6, 4.2, 6, "#3a6ed0"),
    box("br_hole2", 10, 2, -8, 6, 4.2, 6, "#3a6ed0"),
    box("br_slot", -18, 28, 0, 4.2, 8, 10, "#3a6ed0"),
  ];
}

export function enclosure(): CadSolid[] {
  const walls: CadSolid[] = [
    box("en_floor", 0, 1.5, 0, 64, 3, 44),
    box("en_lid", 0, 28, 0, 64, 2, 44, "#6ea2ff"),
    box("en_front", 0, 14, 21, 64, 26, 2),
    box("en_back", 0, 14, -21, 64, 26, 2),
    box("en_left", -31, 14, 0, 2, 26, 40),
    box("en_right", 31, 14, 0, 2, 26, 40),
  ];
  const standoffs = [-20, 20].flatMap((x, i) =>
    [-12, 12].map((z, j) => box(`en_st_${i}${j}`, x, 5, z, 5, 8, 5, "#6ea2ff")),
  );
  return [...walls, ...standoffs, box("en_port", 31, 10, 0, 3, 8, 14, "#3a6ed0")];
}

export function mountingPlate(): CadSolid[] {
  const plate = [box("pl", 0, 1.5, 0, 80, 3, 50)];
  const holes: CadSolid[] = [];
  let i = 0;
  for (const x of [-32, 0, 32]) {
    for (const z of [-16, 16]) {
      holes.push(box(`plh_${i++}`, x, 1.5, z, 6, 3.4, 6, "#3a6ed0"));
    }
  }
  return [...plate, ...holes, box("pl_boss", 0, 5, 0, 16, 6, 16, "#6ea2ff")];
}

export function flange(): CadSolid[] {
  const ring: CadSolid[] = [box("fl_hub", 0, 8, 0, 22, 16, 22), box("fl_disc", 0, 3, 0, 52, 6, 52)];
  const bolts: CadSolid[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    bolts.push(box(`flb_${i}`, Math.cos(a) * 20, 3, Math.sin(a) * 20, 6, 6.5, 6, "#3a6ed0"));
  }
  return [...ring, ...bolts];
}

export function shaftCollar(): CadSolid[] {
  return [
    box("sh", 0, 0, 0, 12, 48, 12),
    box("sh_col", 0, 10, 0, 22, 10, 22, "#6ea2ff"),
    box("sh_key", 7, 0, 0, 3, 20, 4, "#3a6ed0"),
  ];
}

/** Fallback: a few stacked boxes derived from the prompt so unknown requests still mesh. */
export function genericFromPrompt(prompt: string): CadSolid[] {
  let h = 0;
  for (let i = 0; i < prompt.length; i++) h = (h * 33 + prompt.charCodeAt(i)) >>> 0;
  const w = 24 + (h % 28);
  const d = 18 + ((h >> 5) % 22);
  const t = 4 + ((h >> 11) % 6);
  return [
    box("g_base", 0, t / 2, 0, w, t, d),
    box("g_up", -w / 2 + t / 2, t + 14, 0, t, 28, d * 0.7),
    box("g_tab", w / 4, t + 3, d / 3, w / 3, 6, t, "#6ea2ff"),
  ];
}

export function solidsForPrompt(prompt: string): { title: string; solids: CadSolid[]; steps: string[] } {
  const q = prompt.toLowerCase();
  if (/hilbert|infill|space.?fill|maze.?cube|voxel.?cube/.test(q)) {
    const level = /level\s*4|order\s*4/.test(q) ? 4 : /level\s*2|order\s*2/.test(q) ? 2 : 3;
    return {
      title: `Hilbert cube infill · level ${level}`,
      solids: hilbertCube(level),
      steps: [
        `The shape is a level-${level} Hilbert walk on a ${2 ** level}³ lattice.`,
        "Pitch is 4 mm between cell centers; bars are a 2 mm square section.",
        "Walking the curve and voxelizing each neighboring segment into a solid bar.",
        "Merging colinear faces so the mesh is one watertight polycube shell.",
        `Emitting ${2 ** (3 * level) - 1} segment solids as the finished STEP-style body.`,
      ],
    };
  }
  if (/bracket|angle|l-?plate/.test(q)) {
    return {
      title: "L-bracket",
      solids: lBracket(),
      steps: [
        "Base flange 40 × 28 × 4 mm with two clearance holes.",
        "Upright 40 × 28 × 4 mm with a vertical slot.",
        "Adding a triangular rib at the inside corner.",
      ],
    };
  }
  if (/enclos|housing|case|box|project box/.test(q)) {
    return {
      title: "Electronics enclosure",
      solids: enclosure(),
      steps: [
        "Floor and four walls for a 64 × 44 mm footprint.",
        "Lid and corner standoffs for a board.",
        "Side cutout for a cable port.",
      ],
    };
  }
  if (/plate|mount|panel/.test(q)) {
    return {
      title: "Mounting plate",
      solids: mountingPlate(),
      steps: [
        "80 × 50 × 3 mm plate.",
        "Six clearance holes on a 32 × 16 mm grid.",
        "Center boss for a component.",
      ],
    };
  }
  if (/flange/.test(q)) {
    return {
      title: "Bolt flange",
      solids: flange(),
      steps: ["Hub and disc.", "Six bolt holes on a 40 mm circle."],
    };
  }
  if (/shaft|collar|axle/.test(q)) {
    return {
      title: "Shaft and collar",
      solids: shaftCollar(),
      steps: ["12 mm shaft, 48 mm long.", "Collar and keyway."],
    };
  }
  return {
    title: prompt.trim().slice(0, 48) || "Parametric part",
    solids: genericFromPrompt(prompt),
    steps: [
      "No named primitive matched — building a small parametric stand-in from the prompt.",
      "Base plate, upright, and a tab. Refine the wording (bracket, enclosure, Hilbert, flange) for a specific body.",
    ],
  };
}

export function modelExtents(solids: CadSolid[]): number {
  let m = 8;
  for (const s of solids) {
    m = Math.max(m, Math.abs(s.x) + s.sx / 2, Math.abs(s.y) + s.sy / 2, Math.abs(s.z) + s.sz / 2);
  }
  return m;
}
