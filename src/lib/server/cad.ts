import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { shortId } from "../utils";
import { AGENTS } from "../office-data";
import { solidsForPrompt, type CadModel, type CadSolid } from "../cad-geometry";

export type { CadModel, CadSolid };

function storeFile() {
  return path.join(dataDir(), "cad-models.json");
}

interface Store {
  models: CadModel[];
  currentId: string | null;
}

const g = globalThis as unknown as { __cadStore?: Store };

function db(): Store {
  if (g.__cadStore) return g.__cadStore;
  let loaded: Store | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Store;
  } catch {
    /* none */
  }
  g.__cadStore = loaded && Array.isArray(loaded.models) ? loaded : { models: [], currentId: null };
  return g.__cadStore;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(storeFile(), JSON.stringify(g.__cadStore, null, 2));
  } catch {
    /* read-only */
  }
}

export function pickCadAgent(prompt: string): { id: string; name: string; role: string } {
  const q = prompt.toLowerCase();
  const iot = AGENTS.find((a) => a.id === "op_comply");
  const lead = AGENTS.find((a) => a.id === "op_lead");
  const integ = AGENTS.find((a) => a.id === "op_dash");
  const pick =
    /iot|enclos|bracket|flange|shaft|plate|housing|hilbert|mechanical|part/.test(q) && iot
      ? iot
      : /integrat|api|pipeline/.test(q) && integ
        ? integ
        : lead || iot || AGENTS.find((a) => a.dept === "ops")!;
  return { id: pick.id, name: pick.name, role: pick.role };
}

export function listCadModels(): CadModel[] {
  return db().models.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentCadModel(): CadModel | null {
  const s = db();
  return s.models.find((m) => m.id === s.currentId) || s.models[0] || null;
}

export function getCadModel(id: string): CadModel | null {
  return db().models.find((m) => m.id === id) || null;
}

export function saveCadModel(model: CadModel) {
  const s = db();
  const i = s.models.findIndex((m) => m.id === model.id);
  if (i >= 0) s.models[i] = model;
  else s.models.unshift(model);
  s.models = s.models.slice(0, 40);
  s.currentId = model.id;
  persist();
}

export interface CadBuildEvent {
  type: "agent" | "step" | "solids" | "model" | "error";
  agent?: { id: string; name: string; role: string };
  text?: string;
  solids?: CadSolid[];
  model?: CadModel;
  error?: string;
}

export function buildCadModel(prompt: string, agentId?: string): { model: CadModel; events: CadBuildEvent[] } {
  const text = prompt.trim().slice(0, 400);
  if (!text) {
    const err = { type: "error" as const, error: "Prompt required" };
    return { model: null as unknown as CadModel, events: [err] };
  }
  const picked = agentId ? AGENTS.find((a) => a.id === agentId && a.dept === "ops") : undefined;
  const agent = picked
    ? { id: picked.id, name: picked.name, role: picked.role }
    : pickCadAgent(text);
  const now = Date.now();
  const spec = solidsForPrompt(text);
  const model: CadModel = {
    id: shortId("cad"),
    title: spec.title,
    prompt: text,
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    status: "ready",
    solids: spec.solids,
    steps: spec.steps.map((line, i) => ({ id: `s_${i}`, text: line })),
    createdAt: now,
    updatedAt: now,
  };
  saveCadModel(model);
  const events: CadBuildEvent[] = [
    { type: "agent", agent },
    ...model.steps.map((s) => ({ type: "step" as const, text: s.text })),
    { type: "solids", solids: model.solids },
    { type: "model", model },
  ];
  return { model, events };
}

export const CAD_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "cad_build",
    description: "Build a CAD part from a text prompt and show it on the CAD page. Use for brackets, enclosures, plates, flanges, shafts, or Hilbert-style infill.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to model, e.g. level-3 Hilbert cube infill" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "cad_list",
    description: "List recent CAD models built in the Command Center.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "cad_get",
    description: "Get one CAD model by id, including solid count.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

export async function runCadTool(name: string, args: Record<string, unknown>): Promise<string> {
  const wrap = (data: unknown) => JSON.stringify({ ok: true, data });
  try {
    switch (name) {
      case "cad_build": {
        const prompt = String(args.prompt || "").trim();
        if (!prompt) return JSON.stringify({ ok: false, error: "prompt required" });
        const { model } = buildCadModel(prompt);
        return wrap({
          id: model.id,
          title: model.title,
          solids: model.solids.length,
          open: "/cad",
        });
      }
      case "cad_list":
        return wrap(
          listCadModels().map((m) => ({
            id: m.id,
            title: m.title,
            solids: m.solids.length,
            agent: m.agentName,
            updatedAt: m.updatedAt,
          })),
        );
      case "cad_get": {
        const model = getCadModel(String(args.id || ""));
        return model
          ? wrap({ id: model.id, title: model.title, solids: model.solids.length, prompt: model.prompt })
          : JSON.stringify({ ok: false, error: "model not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown cad tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}
