// Plane integration (https://github.com/makeplane/plane).
//
// Plane is an open-source project management platform (Jira/Linear alternative).
// It's the shared PM surface between the Engineering and PMO departments. We talk
// to its Core REST API:
//   GET/POST  {base}/api/v1/workspaces/{slug}/projects/
//   GET/POST  {base}/api/v1/workspaces/{slug}/projects/{id}/work-items/
//   PATCH     {base}/api/v1/workspaces/{slug}/projects/{id}/work-items/{item}/
// Auth is an API key sent as `X-API-Key: plane_api_…` created in Plane settings.
//
// When no instance is configured we fall back to a seeded in-memory mock store
// (persisted to data/) so agents and the PMO page work locally. The PMO page also
// embeds the real Plane web app when an app URL is set.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const STATE_GROUPS = ["backlog", "unstarted", "started", "completed", "cancelled"] as const;
export type StateGroup = (typeof STATE_GROUPS)[number];

export const STATE_LABEL: Record<StateGroup, string> = {
  backlog: "Backlog",
  unstarted: "Todo",
  started: "In Progress",
  completed: "Done",
  cancelled: "Cancelled",
};

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface Project {
  id: string;
  name: string;
  identifier: string;
  description: string;
}

export interface WorkItem {
  id: string;
  name: string;
  description: string;
  projectId: string;
  projectName: string;
  sequenceId: string;
  priority: Priority;
  stateGroup: StateGroup;
  stateLabel: string;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_API = "https://api.plane.so";
const DEFAULT_APP = "https://app.plane.so";

export function planeBaseUrl(): string {
  const raw = getSecret("PLANE_API_URL") || process.env.PLANE_API_URL || DEFAULT_API;
  return raw.replace(/\/+$/, "");
}

export function planeAppUrl(): string | undefined {
  const explicit = getSecret("PLANE_APP_URL") || process.env.PLANE_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = planeBaseUrl();
  if (api.includes("//api.")) return api.replace("//api.", "//app.");
  if (api.includes("api.plane.so")) return DEFAULT_APP;
  return api;
}

export function planeApiKey(): string | undefined {
  return getSecret("PLANE_API_KEY");
}

export function planeWorkspace(): string | undefined {
  return getSecret("PLANE_WORKSPACE_SLUG") || process.env.PLANE_WORKSPACE_SLUG;
}

export function planeConfigured(): boolean {
  return Boolean(planeApiKey() && planeWorkspace());
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", "X-API-Key": planeApiKey() || "" };
}

export interface PlaneStatus {
  mode: "live" | "mock";
  baseUrl: string;
  appUrl?: string;
  workspace?: string;
  hasKey: boolean;
  reachable?: boolean;
  reason?: string;
}

export async function planeStatus(): Promise<PlaneStatus> {
  const hasKey = Boolean(planeApiKey());
  const baseUrl = planeBaseUrl();
  const appUrl = planeAppUrl();
  const workspace = planeWorkspace();
  if (!planeConfigured()) {
    const reason = !hasKey ? "No API key — using local mock projects" : "No workspace slug set — using local mock projects";
    return { mode: "mock", baseUrl, appUrl, workspace, hasKey, reason };
  }
  try {
    const res = await fetch(`${baseUrl}/api/v1/workspaces/${workspace}/projects/?per_page=1`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return { mode: "live", baseUrl, appUrl, workspace, hasKey: true, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, workspace, hasKey: true, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, workspace, hasKey: true, reachable: false, reason: String(e).slice(0, 80) };
  }
}

async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${planeBaseUrl()}${pathname}`, {
    ...init,
    headers: authHeaders(),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Plane ${res.status}: ${text.slice(0, 160)}`);
  }
  return res.json();
}

function unwrapArray<T>(json: unknown, ...keys: string[]): T[] {
  const j = json as Record<string, unknown>;
  if (Array.isArray(j)) return j as T[];
  for (const key of keys) if (Array.isArray(j?.[key])) return j[key] as T[];
  if (Array.isArray(j?.results)) return j.results as T[];
  return [];
}

interface MockDB {
  projects: Project[];
  workItems: WorkItem[];
}

const g = globalThis as unknown as { __planeMock?: MockDB };

function mockFile() {
  return path.join(dataDir(), "plane-mock.json");
}

function seed(): MockDB {
  const now = new Date().toISOString();
  const projects: Project[] = [
    { id: "prj_agents", name: "Agent Platform", identifier: "AGENT", description: "Build and ship client AI agents." },
    { id: "prj_cmd", name: "Client Command Centers", identifier: "OSCC", description: "OS Command Centers that integrate agent fleets for clients." },
    { id: "prj_iot", name: "IoT Devices", identifier: "IOT", description: "Spec and build IoT devices and their agent integrations." },
  ];
  const wi = (id: string, seq: string, name: string, prj: Project, group: StateGroup, priority: Priority, assignee: string | null): WorkItem => ({
    id, name, description: "", projectId: prj.id, projectName: prj.name, sequenceId: seq,
    priority, stateGroup: group, stateLabel: STATE_LABEL[group], assignee, createdAt: now, updatedAt: now,
  });
  const [agents, cmd, iot] = projects;
  const workItems: WorkItem[] = [
    wi("wi_1", "AGENT-12", "Scope the Harbourside intake agent", agents, "started", "high", "PROGRAM MANAGER"),
    wi("wi_2", "AGENT-13", "Build tool-calling layer for support agent", agents, "started", "urgent", "AGENT BUILDER"),
    wi("wi_3", "AGENT-14", "Agent eval harness + regression tests", agents, "unstarted", "medium", "AI INTEGRATIONS"),
    wi("wi_4", "OSCC-4", "Meridian Command Center — integration plan", cmd, "backlog", "high", "PROJECT MANAGER"),
    wi("wi_5", "OSCC-5", "Wire agent fleet into one dashboard", cmd, "unstarted", "medium", "COMMAND CENTER ENG"),
    wi("wi_6", "OSCC-6", "Client sign-off on Command Center v1", cmd, "completed", "medium", "PROGRAM MANAGER"),
    wi("wi_7", "IOT-2", "Spec the warehouse sensor device", iot, "started", "high", "IOT ENGINEER"),
    wi("wi_8", "IOT-3", "Firmware ↔ agent integration design", iot, "backlog", "low", "IOT ENGINEER"),
    wi("wi_9", "IOT-4", "Prototype gateway review", iot, "cancelled", "none", "PROJECT MANAGER"),
  ];
  return { projects, workItems };
}

function db(): MockDB {
  if (g.__planeMock) return g.__planeMock;
  let loaded: MockDB | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8"));
  } catch {
    /* none yet */
  }
  g.__planeMock = loaded && loaded.projects ? loaded : seed();
  persist();
  return g.__planeMock;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(mockFile(), JSON.stringify(g.__planeMock, null, 2));
  } catch {
    /* read-only fs */
  }
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function normProject(o: Record<string, unknown>): Project {
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? "Project"),
    identifier: String(o.identifier ?? ""),
    description: String(o.description ?? ""),
  };
}

function groupFromState(state: unknown, stateMap: Map<string, { group: StateGroup; label: string }>): { group: StateGroup; label: string } {
  if (typeof state === "string" && stateMap.has(state)) return stateMap.get(state)!;
  const g = (state as { group?: string })?.group;
  const found = STATE_GROUPS.find((x) => x === g);
  return { group: found || "backlog", label: found ? STATE_LABEL[found] : "Backlog" };
}

function normWorkItem(o: Record<string, unknown>, project: Project, stateMap: Map<string, { group: StateGroup; label: string }>): WorkItem {
  const now = new Date().toISOString();
  const st = groupFromState(o.state ?? o.state_detail, stateMap);
  const pr = String(o.priority ?? "none").toLowerCase();
  return {
    id: String(o.id ?? ""),
    name: String(o.name ?? "Untitled"),
    description: String(o.description_stripped ?? o.description ?? ""),
    projectId: project.id,
    projectName: project.name,
    sequenceId: o.sequence_id ? `${project.identifier}-${o.sequence_id}` : String(o.id ?? "").slice(0, 6),
    priority: (PRIORITIES.find((p) => p === pr) || "none") as Priority,
    stateGroup: st.group,
    stateLabel: st.label,
    assignee: null,
    createdAt: String(o.created_at ?? now),
    updatedAt: String(o.updated_at ?? now),
  };
}

async function liveStateMap(projectId: string): Promise<Map<string, { group: StateGroup; label: string }>> {
  const map = new Map<string, { group: StateGroup; label: string }>();
  try {
    const json = await liveFetch(`/api/v1/workspaces/${planeWorkspace()}/projects/${projectId}/states/`);
    for (const s of unwrapArray<Record<string, unknown>>(json, "states")) {
      const grp = String(s.group ?? "backlog");
      const group = (STATE_GROUPS.find((x) => x === grp) || "backlog") as StateGroup;
      map.set(String(s.id), { group, label: String(s.name ?? STATE_LABEL[group]) });
    }
  } catch {
    /* no states */
  }
  return map;
}

export async function listProjects(): Promise<Project[]> {
  if (planeConfigured()) {
    try {
      const json = await liveFetch(`/api/v1/workspaces/${planeWorkspace()}/projects/?per_page=100`);
      const arr = unwrapArray<Record<string, unknown>>(json, "projects").map(normProject);
      if (arr.length) return arr;
    } catch {
      /* mock */
    }
  }
  return db().projects.slice();
}

export async function listWorkItems(opts: { projectId?: string; stateGroup?: string; search?: string; limit?: number } = {}): Promise<WorkItem[]> {
  const limit = Math.min(opts.limit ?? 200, 500);
  let items: WorkItem[];
  if (planeConfigured()) {
    try {
      const projects = await listProjects();
      const scoped = opts.projectId ? projects.filter((p) => p.id === opts.projectId) : projects;
      const all: WorkItem[] = [];
      for (const p of scoped) {
        const stateMap = await liveStateMap(p.id);
        const json = await liveFetch(`/api/v1/workspaces/${planeWorkspace()}/projects/${p.id}/work-items/?per_page=100`);
        for (const o of unwrapArray<Record<string, unknown>>(json, "work_items", "results", "issues")) {
          all.push(normWorkItem(o, p, stateMap));
        }
      }
      items = all;
    } catch {
      items = db().workItems.slice();
    }
  } else {
    items = db().workItems.slice();
    if (opts.projectId) items = items.filter((w) => w.projectId === opts.projectId);
  }
  if (opts.stateGroup) items = items.filter((w) => w.stateGroup === opts.stateGroup);
  if (opts.search) {
    const q = opts.search.toLowerCase();
    items = items.filter((w) => w.name.toLowerCase().includes(q) || w.sequenceId.toLowerCase().includes(q) || w.projectName.toLowerCase().includes(q));
  }
  return items.slice(0, limit);
}

export async function createProject(input: { name: string; identifier?: string; description?: string }): Promise<Project> {
  const identifier = (input.identifier || input.name.slice(0, 5).toUpperCase().replace(/[^A-Z0-9]/g, "")) || "PROJ";
  if (planeConfigured()) {
    try {
      const json = await liveFetch(`/api/v1/workspaces/${planeWorkspace()}/projects/`, {
        method: "POST",
        body: JSON.stringify({ name: input.name, identifier, description: input.description || "" }),
      });
      const p = (json as Record<string, unknown>)?.id ? (json as Record<string, unknown>) : null;
      if (p) return normProject(p);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const project: Project = { id: rid("prj"), name: input.name, identifier, description: input.description || "" };
  store.projects.unshift(project);
  persist();
  return project;
}

export async function createWorkItem(input: { name: string; projectId?: string; description?: string; priority?: string; stateGroup?: string; assignee?: string }): Promise<WorkItem> {
  const store = db();
  const project = (await listProjects()).find((p) => p.id === input.projectId) || store.projects[0];
  const priority = (PRIORITIES.find((p) => p === (input.priority || "").toLowerCase()) || "none") as Priority;
  if (planeConfigured() && project) {
    try {
      const json = await liveFetch(`/api/v1/workspaces/${planeWorkspace()}/projects/${project.id}/work-items/`, {
        method: "POST",
        body: JSON.stringify({ name: input.name, description: input.description || "", priority }),
      });
      const o = json as Record<string, unknown>;
      if (o?.id) return normWorkItem(o, project, await liveStateMap(project.id));
    } catch {
      /* mock */
    }
  }
  const group = (STATE_GROUPS.find((x) => x === (input.stateGroup || "").toLowerCase()) || "backlog") as StateGroup;
  const now = new Date().toISOString();
  const seq = `${project?.identifier || "TASK"}-${100 + store.workItems.length}`;
  const item: WorkItem = {
    id: rid("wi"),
    name: input.name,
    description: input.description || "",
    projectId: project?.id || "prj_agents",
    projectName: project?.name || "Agent Platform",
    sequenceId: seq,
    priority,
    stateGroup: group,
    stateLabel: STATE_LABEL[group],
    assignee: input.assignee ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.workItems.unshift(item);
  persist();
  return item;
}

export async function updateWorkItem(id: string, patch: { name?: string; priority?: string; stateGroup?: string; assignee?: string }): Promise<WorkItem | null> {
  const store = db();
  const item = store.workItems.find((w) => w.id === id);
  if (!item) return null;
  if (patch.name !== undefined) item.name = patch.name;
  if (patch.priority) item.priority = (PRIORITIES.find((p) => p === patch.priority!.toLowerCase()) || item.priority) as Priority;
  if (patch.stateGroup) {
    const group = STATE_GROUPS.find((x) => x === patch.stateGroup!.toLowerCase());
    if (group) { item.stateGroup = group; item.stateLabel = STATE_LABEL[group]; }
  }
  if (patch.assignee !== undefined) item.assignee = patch.assignee;
  item.updatedAt = new Date().toISOString();
  persist();
  return item;
}

export interface PmSummary {
  totalProjects: number;
  totalItems: number;
  byState: { group: StateGroup; label: string; count: number }[];
  urgent: number;
}

export async function pmSummary(): Promise<PmSummary> {
  const [projects, items] = await Promise.all([listProjects(), listWorkItems({ limit: 500 })]);
  return {
    totalProjects: projects.length,
    totalItems: items.length,
    byState: STATE_GROUPS.map((group) => ({ group, label: STATE_LABEL[group], count: items.filter((w) => w.stateGroup === group).length })),
    urgent: items.filter((w) => w.priority === "urgent").length,
  };
}

export const PM_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  { name: "pm_summary", description: "Get a project-management summary — project count, work-item counts by state, and urgent items.", parameters: { type: "object", properties: {} } },
  { name: "pm_list_projects", description: "List projects in the workspace.", parameters: { type: "object", properties: {} } },
  { name: "pm_create_project", description: "Create a new project.", parameters: { type: "object", properties: { name: { type: "string" }, identifier: { type: "string", description: "Short key, e.g. AGENT" }, description: { type: "string" } }, required: ["name"] } },
  { name: "pm_list_work_items", description: "List work items (tasks/issues). Filter by project, state group (backlog/unstarted/started/completed/cancelled), or search.", parameters: { type: "object", properties: { projectId: { type: "string" }, stateGroup: { type: "string", enum: [...STATE_GROUPS] }, search: { type: "string" }, limit: { type: "number" } } } },
  { name: "pm_create_work_item", description: "Create a work item in a project — the PMO plans work here for Engineering to pick up.", parameters: { type: "object", properties: { name: { type: "string" }, projectId: { type: "string" }, description: { type: "string" }, priority: { type: "string", enum: [...PRIORITIES] }, stateGroup: { type: "string", enum: [...STATE_GROUPS] }, assignee: { type: "string", description: "Agent name to note as owner" } }, required: ["name"] } },
  { name: "pm_update_work_item", description: "Update a work item — move its state (e.g. to started/completed), change priority, or reassign.", parameters: { type: "object", properties: { id: { type: "string" }, name: { type: "string" }, priority: { type: "string", enum: [...PRIORITIES] }, stateGroup: { type: "string", enum: [...STATE_GROUPS] }, assignee: { type: "string" } }, required: ["id"] } },
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);

export async function runPmTool(name: string, args: Record<string, unknown>): Promise<string> {
  const source = planeConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source, data });
  try {
    switch (name) {
      case "pm_summary":
        return wrap(await pmSummary());
      case "pm_list_projects":
        return wrap(await listProjects());
      case "pm_create_project":
        return wrap(await createProject({ name: s(args.name) || "New project", identifier: s(args.identifier), description: s(args.description) }));
      case "pm_list_work_items":
        return wrap(await listWorkItems({ projectId: s(args.projectId), stateGroup: s(args.stateGroup), search: s(args.search), limit: n(args.limit) }));
      case "pm_create_work_item":
        return wrap(await createWorkItem({ name: s(args.name) || "New work item", projectId: s(args.projectId), description: s(args.description), priority: s(args.priority), stateGroup: s(args.stateGroup), assignee: s(args.assignee) }));
      case "pm_update_work_item": {
        const item = await updateWorkItem(s(args.id) || "", { name: s(args.name), priority: s(args.priority), stateGroup: s(args.stateGroup), assignee: s(args.assignee) });
        return item ? wrap(item) : JSON.stringify({ ok: false, error: "work item not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown pm tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}

export async function planeDiagnostics(): Promise<{
  mode: "live" | "mock";
  baseUrl: string;
  workspace?: string;
  probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[];
}> {
  const baseUrl = planeBaseUrl();
  const workspace = planeWorkspace();
  if (!planeConfigured()) {
    return { mode: "mock", baseUrl, workspace, probes: [{ endpoint: "(none)", ok: false, error: "Set API key + workspace slug in Settings → Connectors → PMO" }] };
  }
  const probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[] = [];
  const projectsPath = `/api/v1/workspaces/${workspace}/projects/?per_page=1`;
  try {
    const res = await fetch(`${baseUrl}${projectsPath}`, { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      probes.push({ endpoint: projectsPath, ok: false, status: res.status });
    } else {
      const json = await res.json();
      const arr = unwrapArray<Record<string, unknown>>(json, "projects");
      probes.push({ endpoint: projectsPath, ok: true, status: res.status, count: arr.length, sampleFields: arr[0] ? Object.keys(arr[0]).slice(0, 20) : [] });
      if (arr[0]?.id) {
        const wiPath = `/api/v1/workspaces/${workspace}/projects/${arr[0].id}/work-items/?per_page=1`;
        try {
          const r2 = await fetch(`${baseUrl}${wiPath}`, { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
          const j2 = r2.ok ? await r2.json() : null;
          const a2 = j2 ? unwrapArray<Record<string, unknown>>(j2, "work_items", "results", "issues") : [];
          probes.push({ endpoint: wiPath, ok: r2.ok, status: r2.status, count: a2.length, sampleFields: a2[0] ? Object.keys(a2[0]).slice(0, 20) : [] });
        } catch (e) {
          probes.push({ endpoint: wiPath, ok: false, error: String(e).slice(0, 100) });
        }
      }
    }
  } catch (e) {
    probes.push({ endpoint: projectsPath, ok: false, error: String(e).slice(0, 100) });
  }
  return { mode: "live", baseUrl, workspace, probes };
}
