import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import type { Routine } from "../types";

function routinesFile() {
  return path.join(dataDir(), "routines.json");
}

export function loadPersistedRoutines(): Routine[] {
  try {
    const raw = JSON.parse(fs.readFileSync(routinesFile(), "utf8"));
    const list = Array.isArray(raw) ? raw : raw?.routines;
    if (!Array.isArray(list)) return [];
    return list.filter((r) => r && typeof r.id === "string" && typeof r.title === "string");
  } catch {
    return [];
  }
}

export function savePersistedRoutines(routines: Routine[]): void {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(routinesFile(), JSON.stringify(routines, null, 2));
  } catch {
    /* volume may be read-only */
  }
}
