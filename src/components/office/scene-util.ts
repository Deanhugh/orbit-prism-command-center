import type { DeptId } from "@/lib/types";
import { DEPARTMENTS } from "@/lib/office-data";

export const POD_RADIUS = 6.2;

export interface PodLayout {
  id: DeptId;
  x: number;
  z: number;
  w: number;
  d: number;
  seatPositions: [number, number][]; // local x,z on the platform top
}

function seatGrid(seats: number, w: number, d: number): [number, number][] {
  const cols = Math.ceil(Math.sqrt(seats));
  const rows = Math.ceil(seats / cols);
  const out: [number, number][] = [];
  const padX = w * 0.62;
  const padZ = d * 0.58;
  for (let i = 0; i < seats; i++) {
    const r = Math.floor(i / cols);
    const c = i % cols;
    const x = cols === 1 ? 0 : (c / (cols - 1) - 0.5) * padX;
    const z = rows === 1 ? 0 : (r / (rows - 1) - 0.5) * padZ;
    out.push([x, z]);
  }
  return out;
}

export interface ScenePalette {
  bg: string;
  ground: string;
  walkway: string;
  platform: string;
  skirt: string;
  deskTop: string;
  deskLeg: string;
  chair: string;
  head: string;
  monitorIdle: string;
  brainPad: string;
  brainCore: string;
  brainEmissive: string;
  brainNode: string;
  contact: string;
  ambient: number;
}

export function scenePalette(dark: boolean): ScenePalette {
  return dark
    ? {
        bg: "#0A0514",
        ground: "#1C1F26",
        walkway: "#2C2331",
        platform: "#2C2331",
        skirt: "#1C1F26",
        deskTop: "#3a3144",
        deskLeg: "#2C2331",
        chair: "#3a3144",
        head: "#e8eef0",
        monitorIdle: "#68BCD3",
        brainPad: "#1C1F26",
        brainCore: "#e2f5f1",
        brainEmissive: "#68BCD3",
        brainNode: "#68BCD3",
        contact: "#000000",
        ambient: 0.4,
      }
    : {
        bg: "#e6ddca",
        ground: "#c2b088",
        walkway: "#a89572",
        platform: "#f4ecda",
        skirt: "#cbbd9f",
        deskTop: "#c9bfa8",
        deskLeg: "#b7ac93",
        chair: "#7d7360",
        head: "#e7d3b8",
        monitorIdle: "#8f8674",
        brainPad: "#efe6d2",
        brainCore: "#f8f3e8",
        brainEmissive: "#e0c885",
        brainNode: "#a8925f",
        contact: "#5a4a2a",
        ambient: 0.55,
      };
}

/** Sales' accent is near-black; brighten it for dark backgrounds. */
export function accentFor(dark: boolean, deptId: DeptId, accent: string): string {
  if (dark && deptId === "sales") return "#c9c4bb";
  return accent;
}

export function podLayouts(): PodLayout[] {
  return DEPARTMENTS.map((dept) => {
    const x = Math.cos(dept.angle) * POD_RADIUS;
    const z = Math.sin(dept.angle) * POD_RADIUS;
    const w = 2.6 + dept.seats * 0.14;
    const d = 2.4 + dept.seats * 0.12;
    return { id: dept.id, x, z, w, d, seatPositions: seatGrid(dept.seats, w, d) };
  });
}
