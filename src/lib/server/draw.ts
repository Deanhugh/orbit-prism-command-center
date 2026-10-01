import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { shortId } from "../utils";
import { AGENTS } from "../office-data";
import { DRAW_PAPER, sceneForPrompt, type DrawBoard, type DrawJsonElement } from "../draw-scene";

export type { DrawBoard, DrawJsonElement };

function storeFile() {
  return path.join(dataDir(), "draw-boards.json");
}

interface Store {
  boards: DrawBoard[];
  currentId: string | null;
}

const g = globalThis as unknown as { __drawStore?: Store };

function db(): Store {
  if (g.__drawStore) return g.__drawStore;
  let loaded: Store | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(storeFile(), "utf8")) as Store;
  } catch {
    /* none */
  }
  g.__drawStore = loaded && Array.isArray(loaded.boards) ? loaded : { boards: [], currentId: null };
  return g.__drawStore;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(storeFile(), JSON.stringify(g.__drawStore, null, 2));
  } catch {
    /* read-only */
  }
}

const CREW = new Set(["mk_gfx", "mk_lead", "mk_social", "op_lead"]);

export function pickDrawAgent(prompt: string): { id: string; name: string; role: string } {
  const q = prompt.toLowerCase();
  const brand = AGENTS.find((a) => a.id === "mk_gfx");
  const content = AGENTS.find((a) => a.id === "mk_lead");
  const social = AGENTS.find((a) => a.id === "mk_social");
  const eng = AGENTS.find((a) => a.id === "op_lead");
  const pick =
    /\b(arch|system|api|stack|service)\b/.test(q) && eng
      ? eng
      : /\b(reel|social|campaign)\b/.test(q) && social
        ? social
        : /\b(flow|process|content|story)\b/.test(q) && content
          ? content
          : brand || content || social || AGENTS.find((a) => a.dept === "marketing")!;
  return { id: pick.id, name: pick.name, role: pick.role };
}

export function listDrawBoards(): DrawBoard[] {
  return db().boards.slice().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function currentDrawBoard(): DrawBoard | null {
  const s = db();
  return s.boards.find((m) => m.id === s.currentId) || s.boards[0] || null;
}

export function getDrawBoard(id: string): DrawBoard | null {
  return db().boards.find((m) => m.id === id) || null;
}

export function saveDrawBoard(board: DrawBoard) {
  const s = db();
  const i = s.boards.findIndex((m) => m.id === board.id);
  if (i >= 0) s.boards[i] = board;
  else s.boards.unshift(board);
  s.boards = s.boards.slice(0, 40);
  s.currentId = board.id;
  persist();
}

export function patchDrawBoard(
  id: string,
  patch: { elements?: DrawJsonElement[]; appState?: { viewBackgroundColor: string } },
): DrawBoard | null {
  const board = getDrawBoard(id);
  if (!board) return null;
  if (patch.elements) board.elements = patch.elements;
  if (patch.appState) board.appState = patch.appState;
  board.updatedAt = Date.now();
  saveDrawBoard(board);
  return board;
}

export interface DrawBuildEvent {
  type: "agent" | "step" | "board" | "error";
  agent?: { id: string; name: string; role: string };
  text?: string;
  board?: DrawBoard;
  error?: string;
}

export function buildDrawBoard(prompt: string, agentId?: string): { board: DrawBoard; events: DrawBuildEvent[] } {
  const text = prompt.trim().slice(0, 400);
  if (!text) {
    const err = { type: "error" as const, error: "Prompt required" };
    return { board: null as unknown as DrawBoard, events: [err] };
  }
  const picked = agentId ? AGENTS.find((a) => a.id === agentId && CREW.has(a.id)) : undefined;
  const agent = picked
    ? { id: picked.id, name: picked.name, role: picked.role }
    : pickDrawAgent(text);
  const now = Date.now();
  const spec = sceneForPrompt(text);
  const board: DrawBoard = {
    id: shortId("draw"),
    title: spec.title,
    prompt: text,
    agentId: agent.id,
    agentName: agent.name,
    agentRole: agent.role,
    status: "ready",
    elements: spec.elements,
    appState: { viewBackgroundColor: DRAW_PAPER },
    steps: spec.steps.map((line, i) => ({ id: `s_${i}`, text: line })),
    createdAt: now,
    updatedAt: now,
  };
  saveDrawBoard(board);
  const events: DrawBuildEvent[] = [
    { type: "agent", agent },
    ...board.steps.map((s) => ({ type: "step" as const, text: s.text })),
    { type: "board", board },
  ];
  return { board, events };
}

export const DRAW_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "draw_sketch",
    description:
      "Sketch a whiteboard on the Draw page (Excalidraw). Use for flowcharts, architecture, wireframes, org charts, mind maps, or any diagram.",
    parameters: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "What to draw, e.g. onboarding flowchart" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "draw_list",
    description: "List recent Draw boards in the Command Center.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "draw_get",
    description: "Get one Draw board by id, including element count.",
    parameters: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
];

export async function runDrawTool(name: string, args: Record<string, unknown>): Promise<string> {
  const wrap = (data: unknown) => JSON.stringify({ ok: true, data });
  try {
    switch (name) {
      case "draw_sketch": {
        const prompt = String(args.prompt || "").trim();
        if (!prompt) return JSON.stringify({ ok: false, error: "prompt required" });
        const { board } = buildDrawBoard(prompt);
        return wrap({
          id: board.id,
          title: board.title,
          elements: board.elements.length,
          open: "/draw",
        });
      }
      case "draw_list":
        return wrap(
          listDrawBoards().map((m) => ({
            id: m.id,
            title: m.title,
            elements: m.elements.length,
            agent: m.agentName,
            updatedAt: m.updatedAt,
          })),
        );
      case "draw_get": {
        const board = getDrawBoard(String(args.id || ""));
        return board
          ? wrap({
              id: board.id,
              title: board.title,
              elements: board.elements.length,
              prompt: board.prompt,
              open: "/draw",
            })
          : JSON.stringify({ ok: false, error: "board not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown draw tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}
