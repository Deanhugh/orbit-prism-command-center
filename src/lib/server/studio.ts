import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { shortId } from "../utils";
import { AGENTS } from "../office-data";
import {
  productionForPrompt,
  productionRuntimeSec,
  type StudioProduction,
  type StudioShot,
} from "../studio-production";

export type { StudioProduction, StudioShot };

function storeFile() {
  return path.join(dataDir(), "studio-productions.json");
}

interface Store {
  productions: StudioProduction[];
  currentId: string | null;
}

const g = globalThis as unknown as { __studioStore?: Store };

function db(): Store {
  if (g.__studioStore) return g.__studioStore;
  let loaded: Store | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Store;
  } catch {
    /* none */
  }
  g.__studioStore =
    loaded && Array.isArray(loaded.productions) ? loaded : { productions: [], currentId: null };
  return g.__studioStore;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(storeFile(), JSON.stringify(g.__studioStore, null, 2));
  } catch {
    /* read-only */
  }
}

const CREW = new Set(["mk_gfx", "mk_lead", "mk_social"]);

export function pickStudioAgent(prompt: string): { id: string; name: string; role: string } {
  const q = prompt.toLowerCase();
  const brand = AGENTS.find((a) => a.id === "mk_gfx");
  const social = AGENTS.find((a) => a.id === "mk_social");
  const lead = AGENTS.find((a) => a.id === "mk_lead");
  const pick =
    /\b(reel|tiktok|short|social|caption)\b/.test(q) && social
      ? social
      : /\b(brand|look|identity|product|hero)\b/.test(q) && brand
        ? brand
        : lead || brand || social || AGENTS.find((a) => a.dept === "marketing")!;
  return { id: pick.id, name: pick.name, role: pick.role };
}

export function listStudioProductions(): StudioProduction[] {
  return db().productions.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentStudioProduction(): StudioProduction | null {
  const s = db();
  return s.productions.find((m) => m.id === s.currentId) || s.productions[0] || null;
}

export function getStudioProduction(id: string): StudioProduction | null {
  return db().productions.find((m) => m.id === id) || null;
}

export function saveStudioProduction(model: StudioProduction) {
  const s = db();
  const i = s.productions.findIndex((m) => m.id === model.id);
  if (i >= 0) s.productions[i] = model;
  else s.productions.unshift(model);
  s.productions = s.productions.slice(0, 40);
  s.currentId = model.id;
  persist();
}

export interface StudioBuildEvent {
  type: "agent" | "step" | "shots" | "model" | "error";
  agent?: { id: string; name: string; role: string };
  text?: string;
  shots?: StudioShot[];
  model?: StudioProduction;
  error?: string;
}

export function buildStudioProduction(
  prompt: string,
  agentId?: string,
): { model: StudioProduction; events: StudioBuildEvent[] } {
  const text = prompt.trim().slice(0, 400);
  if (!text) {
    const err = { type: "error" as const, error: "Prompt required" };
    return { model: null as unknown as StudioProduction, events: [err] };
  }
  const picked = agentId ? AGENTS.find((a) => a.id === agentId && CREW.has(a.id)) : undefined;
  const agent = picked
    ? { id: picked.id, name: picked.name, role: picked.role }
    : pickStudioAgent(text);
  const now = Date.now();
  const spec = productionForPrompt(text);
  const model: StudioProduction = {
    id: shortId("vid"),
    title: spec.title,
    logline: spec.logline,
    prompt: text,
    kind: spec.kind,
    aspect: spec.aspect,
    runtimeSec: productionRuntimeSec(spec.shots),
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    status: "ready",
    shots: spec.shots,
    steps: spec.steps.map((line, i) => ({ id: `s_${i}`, text: line })),
    createdAt: now,
    updatedAt: now,
  };
  saveStudioProduction(model);
  const events: StudioBuildEvent[] = [
    { type: "agent", agent },
    ...model.steps.map((s) => ({ type: "step" as const, text: s.text })),
    { type: "shots", shots: model.shots },
    { type: "model", model },
  ];
  return { model, events };
}

export const STUDIO_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "studio_produce",
    description:
      "Cut a video production from a text prompt and show it on the Studio page. Use for reels, product films, explainers, trailers, talking-head spots, or documentaries.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to produce, e.g. a 30s product film for the new enclosure" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "studio_list",
    description: "List recent Studio productions in the Command Center.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "studio_get",
    description: "Get one Studio production by id, including shot count and runtime.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

export async function runStudioTool(name: string, args: Record<string, unknown>): Promise<string> {
  const wrap = (data: unknown) => JSON.stringify({ ok: true, data });
  try {
    switch (name) {
      case "studio_produce": {
        const prompt = String(args.prompt || "").trim();
        if (!prompt) return JSON.stringify({ ok: false, error: "prompt required" });
        const { model } = buildStudioProduction(prompt);
        return wrap({
          id: model.id,
          title: model.title,
          kind: model.kind,
          shots: model.shots.length,
          runtimeSec: model.runtimeSec,
          open: "/studio",
        });
      }
      case "studio_list":
        return wrap(
          listStudioProductions().map((m) => ({
            id: m.id,
            title: m.title,
            kind: m.kind,
            shots: m.shots.length,
            runtimeSec: m.runtimeSec,
            agent: m.agentName,
            updatedAt: m.updatedAt,
          })),
        );
      case "studio_get": {
        const model = getStudioProduction(String(args.id || ""));
        return model
          ? wrap({
              id: model.id,
              title: model.title,
              kind: model.kind,
              shots: model.shots.length,
              runtimeSec: model.runtimeSec,
              prompt: model.prompt,
            })
          : JSON.stringify({ ok: false, error: "production not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown studio tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}
