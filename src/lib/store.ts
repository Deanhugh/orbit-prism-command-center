"use client";

import { create } from "zustand";
import type {
  AgentMessage,
  AgentRuntimeInfo,
  Connector,
  DeptId,
  OfficeEvent,
  Routine,
  RunMode,
  Task,
} from "./types";

interface OfficeStore {
  name: string;
  mode: RunMode;
  modeReason: string;
  model: string;
  connectors: Connector[];
  tasks: Task[];
  routines: Routine[];
  agents: AgentRuntimeInfo[];
  messages: AgentMessage[];
  usage: { session: number; week: number };
  selectedDept: DeptId | "all";
  brainOpen: boolean;
  boardOpen: boolean;
  activeTaskId: string | null;
  pulses: Record<string, number>;
  connected: boolean;
  theme: "light" | "dark";

  setSelectedDept: (d: DeptId | "all") => void;
  setBrainOpen: (v: boolean) => void;
  setBoardOpen: (v: boolean) => void;
  setActiveTask: (id: string | null) => void;
  setTheme: (t: "light" | "dark") => void;
  toggleTheme: () => void;

  connect: () => void;
  createTask: (title: string, dept: DeptId, model?: string, repeat?: string) => Promise<void>;
  actOnTask: (id: string, action: "approve" | "reject") => Promise<void>;
  refreshMode: () => Promise<void>;
  routineAction: (id: string, action: "pause" | "resume" | "run" | "delete") => Promise<void>;
  askJarvis: (instruction: string) => Promise<string>;
  resetBudget: (agentId: string) => Promise<void>;
}

function upsertTask(list: Task[], task: Task): Task[] {
  const idx = list.findIndex((t) => t.id === task.id);
  if (idx === -1) return [task, ...list];
  const copy = [...list];
  copy[idx] = task;
  return copy;
}

function upsertRoutine(list: Routine[], r: Routine): Routine[] {
  const idx = list.findIndex((x) => x.id === r.id);
  if (idx === -1) return [...list, r];
  const copy = [...list];
  copy[idx] = r;
  return copy;
}

export const useOffice = create<OfficeStore>((set, get) => ({
  name: "Orbit Prism Operating System",
  mode: "demo",
  modeReason: "connecting…",
  model: "sonnet",
  connectors: [],
  tasks: [],
  routines: [],
  agents: [],
  messages: [],
  usage: { session: 0, week: 0 },
  selectedDept: "all",
  brainOpen: false,
  boardOpen: false,
  activeTaskId: null,
  pulses: {},
  connected: false,
  theme: "dark",

  setSelectedDept: (d) => set({ selectedDept: d }),
  setBrainOpen: (v) => set({ brainOpen: v }),
  setBoardOpen: (v) => set({ boardOpen: v }),
  setActiveTask: (id) => set({ activeTaskId: id }),
  setTheme: () => {
    set({ theme: "dark" });
  },
  toggleTheme: () => {
    set({ theme: "dark" });
  },

  connect: () => {
    if (get().connected) return;
    set({ connected: true });
    const es = new EventSource("/api/events");
    es.onmessage = (ev) => {
      let data: OfficeEvent;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === "snapshot") {
        const s = data.snapshot;
        set({
          name: s.name,
          mode: s.mode,
          modeReason: s.modeReason,
          model: s.model,
          connectors: s.connectors,
          tasks: s.tasks,
          routines: s.routines,
          agents: s.agents,
          usage: s.usage,
        });
      } else if (data.type === "task") {
        set((st) => ({ tasks: upsertTask(st.tasks, data.task) }));
      } else if (data.type === "routine") {
        set((st) => ({ routines: upsertRoutine(st.routines, data.routine) }));
      } else if (data.type === "agent") {
        set((st) => {
          const idx = st.agents.findIndex((a) => a.id === data.agent.id);
          const agents = [...st.agents];
          if (idx === -1) agents.push(data.agent);
          else agents[idx] = data.agent;
          return { agents };
        });
      } else if (data.type === "message") {
        set((st) => ({ messages: [...st.messages, data.message].slice(-500) }));
      } else if (data.type === "connector_pulse") {
        set((st) => ({ pulses: { ...st.pulses, [data.key]: Date.now() } }));
      }
    };
    es.onerror = () => {
      /* browser auto-reconnects */
    };
  },

  createTask: async (title, dept, model, repeat) => {
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, dept, model, repeat }),
    });
  },

  actOnTask: async (id, action) => {
    await fetch(`/api/tasks/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
  },

  refreshMode: async () => {
    const res = await fetch("/api/office", { method: "POST" });
    const s = await res.json();
    set({ mode: s.mode, modeReason: s.modeReason, connectors: s.connectors });
  },

  routineAction: async (id, action) => {
    const res = await fetch("/api/routines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    const data = await res.json();
    if (data.routines) set({ routines: data.routines });
  },

  askJarvis: async (instruction) => {
    const res = await fetch("/api/jarvis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    const data = await res.json();
    return (data.reply as string) || "";
  },

  resetBudget: async (agentId) => {
    await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: agentId, action: "reset" }),
    });
  },
}));
