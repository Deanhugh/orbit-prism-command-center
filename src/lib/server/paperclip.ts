// Paperclip integration (https://github.com/paperclipai/paperclip).
//
// Paperclip is an open-source agent control plane (org / goals / issues /
// heartbeats). Command Center talks to its REST API:
//   GET/POST  {base}/api/companies/{companyId}/issues
//   GET/PATCH {base}/api/issues/{id}
//   POST      {base}/api/issues/{id}/comments
//   POST      {base}/api/issues/{id}/checkout
// Auth is a Bearer token created in Paperclip (board or agent API key).
//
// When no instance is configured we fall back to a seeded in-memory mock store
// (persisted to data/) so Jarvis, Engineering, and PMO can still open issues
// locally. The Paperclip page also embeds the real web app when an app URL is set.

import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret } from "./providers";

export const ISSUE_STATUSES = [
  "backlog",
  "todo",
  "in_progress",
  "in_review",
  "done",
  "blocked",
  "cancelled",
] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export const STATUS_LABEL: Record<IssueStatus, string> = {
  backlog: "Backlog",
  todo: "Todo",
  in_progress: "In Progress",
  in_review: "In Review",
  done: "Done",
  blocked: "Blocked",
  cancelled: "Cancelled",
};

export const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;
export type Priority = (typeof PRIORITIES)[number];

export interface PaperclipIssue {
  id: string;
  identifier: string;
  title: string;
  description: string;
  status: IssueStatus;
  priority: Priority;
  projectName: string | null;
  assignee: string | null;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_API = "";

export function paperclipBaseUrl(): string {
  const raw = getSecret("PAPERCLIP_API_URL") || process.env.PAPERCLIP_API_URL || DEFAULT_API;
  return raw.replace(/\/+$/, "");
}

export function paperclipAppUrl(): string | undefined {
  const explicit = getSecret("PAPERCLIP_APP_URL") || process.env.PAPERCLIP_APP_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const api = paperclipBaseUrl();
  return api || undefined;
}

export function paperclipApiKey(): string | undefined {
  return getSecret("PAPERCLIP_API_KEY");
}

export function paperclipCompanyId(): string | undefined {
  return getSecret("PAPERCLIP_COMPANY_ID") || process.env.PAPERCLIP_COMPANY_ID;
}

export function paperclipConfigured(): boolean {
  return Boolean(paperclipApiKey() && paperclipCompanyId() && paperclipBaseUrl());
}

function authHeaders(): Record<string, string> {
  return { "Content-Type": "application/json", Authorization: `Bearer ${paperclipApiKey() || ""}`, Accept: "application/json" };
}

export interface PaperclipStatus {
  mode: "live" | "mock";
  baseUrl: string;
  appUrl?: string;
  companyId?: string;
  hasKey: boolean;
  reachable?: boolean;
  reason?: string;
}

export async function paperclipStatus(): Promise<PaperclipStatus> {
  const hasKey = Boolean(paperclipApiKey());
  const baseUrl = paperclipBaseUrl();
  const appUrl = paperclipAppUrl();
  const companyId = paperclipCompanyId();
  if (!paperclipConfigured()) {
    const reason = !baseUrl
      ? "No API URL — using local mock issues"
      : !hasKey
        ? "No API key — using local mock issues"
        : "No company ID set — using local mock issues";
    let reachable: boolean | undefined;
    if (baseUrl) {
      try {
        const res = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(6000) });
        reachable = res.ok;
      } catch {
        reachable = false;
      }
    }
    return { mode: "mock", baseUrl, appUrl, companyId, hasKey, reachable, reason };
  }
  try {
    const res = await fetch(`${baseUrl}/api/companies/${companyId}/issues?limit=1`, {
      headers: authHeaders(),
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) return { mode: "live", baseUrl, appUrl, companyId, hasKey: true, reachable: true, reason: "Connected" };
    return { mode: "live", baseUrl, appUrl, companyId, hasKey: true, reachable: false, reason: `HTTP ${res.status}` };
  } catch (e) {
    return { mode: "live", baseUrl, appUrl, companyId, hasKey: true, reachable: false, reason: String(e).slice(0, 80) };
  }
}

async function liveFetch(pathname: string, init?: RequestInit): Promise<unknown> {
  const res = await fetch(`${paperclipBaseUrl()}${pathname}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers || {}) },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Paperclip ${res.status}: ${text.slice(0, 160)}`);
  }
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function unwrapArray<T>(json: unknown, ...keys: string[]): T[] {
  if (Array.isArray(json)) return json as T[];
  const j = json as Record<string, unknown> | null;
  if (!j || typeof j !== "object") return [];
  for (const key of keys) if (Array.isArray(j[key])) return j[key] as T[];
  if (Array.isArray(j.results)) return j.results as T[];
  if (Array.isArray(j.items)) return j.items as T[];
  return [];
}

interface MockDB {
  issues: PaperclipIssue[];
}

const g = globalThis as unknown as { __paperclipMock?: MockDB };

function mockFile() {
  return path.join(dataDir(), "paperclip-mock.json");
}

function seed(): MockDB {
  const now = new Date().toISOString();
  const iss = (
    id: string,
    identifier: string,
    title: string,
    status: IssueStatus,
    priority: Priority,
    assignee: string | null,
    projectName: string,
  ): PaperclipIssue => ({
    id, identifier, title, description: "", status, priority, projectName, assignee, createdAt: now, updatedAt: now,
  });
  return {
    issues: [
      iss("pci_1", "ORB-12", "Stand up Paperclip as the agent issue board", "in_progress", "high", "JARVIS", "Orbit Prism"),
      iss("pci_2", "ORB-13", "Wire Engineering agents to checkout Paperclip issues", "todo", "high", "ENGINEERING LEAD", "Orbit Prism"),
      iss("pci_3", "ORB-14", "PMO files client work as Paperclip issues, not Orbit tasks", "todo", "medium", "PROGRAM MANAGER", "Orbit Prism"),
      iss("pci_4", "ORB-15", "Command Center iframe + Open in Paperclip", "in_review", "medium", "COMMAND CENTER ENG", "Orbit Prism"),
      iss("pci_5", "ORB-16", "Mint a board API key for Command Center", "backlog", "high", "JARVIS", "Orbit Prism"),
      iss("pci_6", "ORB-17", "Spec the warehouse sensor heartbeat", "blocked", "low", "IOT ENGINEER", "IoT Devices"),
      iss("pci_7", "ORB-18", "Client sign-off on Command Center v1", "done", "medium", "PROJECT MANAGER", "Client OS"),
    ],
  };
}

function db(): MockDB {
  if (g.__paperclipMock) return g.__paperclipMock;
  let loaded: MockDB | null = null;
  try {
    loaded = JSON.parse(fs.readFileSync(mockFile(), "utf8"));
  } catch {
    /* none yet */
  }
  g.__paperclipMock = loaded && loaded.issues ? loaded : seed();
  persist();
  return g.__paperclipMock;
}

function persist() {
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(mockFile(), JSON.stringify(g.__paperclipMock, null, 2));
  } catch {
    /* read-only fs */
  }
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function asStatus(raw: unknown): IssueStatus {
  const s = String(raw ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  return (ISSUE_STATUSES.find((x) => x === s) || "backlog") as IssueStatus;
}

function asPriority(raw: unknown): Priority {
  const p = String(raw ?? "none").toLowerCase();
  if (p === "critical") return "urgent";
  return (PRIORITIES.find((x) => x === p) || "none") as Priority;
}

function normIssue(o: Record<string, unknown>): PaperclipIssue {
  const now = new Date().toISOString();
  const project = o.project as Record<string, unknown> | undefined;
  return {
    id: String(o.id ?? ""),
    identifier: String(o.identifier ?? o.id ?? "").slice(0, 16),
    title: String(o.title ?? o.name ?? "Untitled"),
    description: String(o.description ?? ""),
    status: asStatus(o.status),
    priority: asPriority(o.priority),
    projectName: project?.name ? String(project.name) : o.projectName ? String(o.projectName) : null,
    assignee: o.assigneeAgentId ? String(o.assigneeAgentId) : o.assignee ? String(o.assignee) : null,
    createdAt: String(o.createdAt ?? o.created_at ?? now),
    updatedAt: String(o.updatedAt ?? o.updated_at ?? now),
  };
}

export async function listIssues(opts: { status?: string; search?: string; limit?: number } = {}): Promise<PaperclipIssue[]> {
  const limit = Math.min(opts.limit ?? 200, 500);
  let items: PaperclipIssue[];
  if (paperclipConfigured()) {
    try {
      const companyId = paperclipCompanyId();
      const qs = opts.status ? `?status=${encodeURIComponent(opts.status)}` : "";
      const json = await liveFetch(`/api/companies/${companyId}/issues${qs}`);
      items = unwrapArray<Record<string, unknown>>(json, "issues").map(normIssue);
    } catch {
      items = db().issues.slice();
    }
  } else {
    items = db().issues.slice();
  }
  if (opts.status) {
    const wanted = opts.status.split(",").map((s) => s.trim().toLowerCase());
    items = items.filter((i) => wanted.includes(i.status));
  }
  if (opts.search) {
    const q = opts.search.toLowerCase();
    items = items.filter((i) => i.title.toLowerCase().includes(q) || i.identifier.toLowerCase().includes(q) || (i.projectName || "").toLowerCase().includes(q));
  }
  return items.slice(0, limit);
}

export async function createIssue(input: {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  assignee?: string;
}): Promise<PaperclipIssue> {
  const status = asStatus(input.status || "todo");
  const priority = asPriority(input.priority || "medium");
  if (paperclipConfigured()) {
    try {
      const json = await liveFetch(`/api/companies/${paperclipCompanyId()}/issues`, {
        method: "POST",
        body: JSON.stringify({
          title: input.title,
          description: input.description || "",
          status,
          priority,
        }),
      });
      const o = json as Record<string, unknown>;
      if (o?.id) return normIssue(o);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const now = new Date().toISOString();
  const item: PaperclipIssue = {
    id: rid("pci"),
    identifier: `ORB-${100 + store.issues.length}`,
    title: input.title,
    description: input.description || "",
    status,
    priority,
    projectName: "Orbit Prism",
    assignee: input.assignee ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.issues.unshift(item);
  persist();
  return item;
}

export async function updateIssue(
  id: string,
  patch: { title?: string; status?: string; priority?: string; assignee?: string; comment?: string },
): Promise<PaperclipIssue | null> {
  if (paperclipConfigured()) {
    try {
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.status) body.status = asStatus(patch.status);
      if (patch.priority) body.priority = asPriority(patch.priority);
      if (patch.comment) body.comment = patch.comment;
      const json = await liveFetch(`/api/issues/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      const o = json as Record<string, unknown>;
      if (o?.id) return normIssue(o);
    } catch {
      /* mock */
    }
  }
  const store = db();
  const item = store.issues.find((w) => w.id === id || w.identifier === id);
  if (!item) return null;
  if (patch.title !== undefined) item.title = patch.title;
  if (patch.priority) item.priority = asPriority(patch.priority);
  if (patch.status) item.status = asStatus(patch.status);
  if (patch.assignee !== undefined) item.assignee = patch.assignee;
  item.updatedAt = new Date().toISOString();
  persist();
  return item;
}

export async function addComment(id: string, body: string): Promise<{ ok: boolean; id?: string }> {
  if (paperclipConfigured()) {
    try {
      const json = await liveFetch(`/api/issues/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      const o = json as Record<string, unknown>;
      return { ok: true, id: o?.id ? String(o.id) : undefined };
    } catch {
      /* mock */
    }
  }
  const item = await updateIssue(id, { comment: body });
  return { ok: Boolean(item) };
}

export async function checkoutIssue(id: string, agentId?: string): Promise<PaperclipIssue | null> {
  if (paperclipConfigured()) {
    try {
      const json = await liveFetch(`/api/issues/${id}/checkout`, {
        method: "POST",
        body: JSON.stringify({
          agentId: agentId || undefined,
          expectedStatuses: ["todo", "backlog", "blocked", "in_review"],
        }),
      });
      const o = json as Record<string, unknown>;
      if (o?.id) return normIssue(o);
    } catch {
      /* mock */
    }
  }
  return updateIssue(id, { status: "in_progress", assignee: agentId });
}

export interface PaperclipSummary {
  totalIssues: number;
  byStatus: { status: IssueStatus; label: string; count: number }[];
  urgent: number;
}

export async function paperclipSummary(): Promise<PaperclipSummary> {
  const items = await listIssues({ limit: 500 });
  return {
    totalIssues: items.length,
    byStatus: ISSUE_STATUSES.map((status) => ({
      status,
      label: STATUS_LABEL[status],
      count: items.filter((w) => w.status === status).length,
    })),
    urgent: items.filter((w) => w.priority === "urgent" || w.priority === "high").length,
  };
}

export const PAPERCLIP_TOOLS: { name: string; description: string; parameters: Record<string, unknown> }[] = [
  { name: "paperclip_summary", description: "Get a Paperclip issue-board summary — counts by status and high/urgent items.", parameters: { type: "object", properties: {} } },
  { name: "paperclip_list_issues", description: "List Paperclip issues. Filter by status (backlog/todo/in_progress/in_review/done/blocked/cancelled) or search.", parameters: { type: "object", properties: { status: { type: "string" }, search: { type: "string" }, limit: { type: "number" } } } },
  { name: "paperclip_create_issue", description: "Open a new Paperclip issue — use this instead of Orbit's in-memory task list when work should live on the Paperclip board.", parameters: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, status: { type: "string", enum: [...ISSUE_STATUSES] }, priority: { type: "string", enum: [...PRIORITIES] }, assignee: { type: "string" } }, required: ["title"] } },
  { name: "paperclip_update_issue", description: "Update a Paperclip issue — change status (e.g. to in_progress/done), priority, title, or add a comment.", parameters: { type: "object", properties: { id: { type: "string" }, title: { type: "string" }, status: { type: "string", enum: [...ISSUE_STATUSES] }, priority: { type: "string", enum: [...PRIORITIES] }, assignee: { type: "string" }, comment: { type: "string" } }, required: ["id"] } },
  { name: "paperclip_checkout_issue", description: "Checkout (claim) a Paperclip issue so this agent owns it and it moves to in_progress.", parameters: { type: "object", properties: { id: { type: "string" }, agentId: { type: "string" } }, required: ["id"] } },
  { name: "paperclip_add_comment", description: "Add a comment on a Paperclip issue.", parameters: { type: "object", properties: { id: { type: "string" }, body: { type: "string" } }, required: ["id", "body"] } },
];

const s = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const n = (v: unknown): number | undefined => (typeof v === "number" ? v : typeof v === "string" && v ? Number(v) : undefined);

export async function runPaperclipTool(name: string, args: Record<string, unknown>): Promise<string> {
  const source = paperclipConfigured() ? "live" : "mock";
  const wrap = (data: unknown) => JSON.stringify({ ok: true, source, data });
  try {
    switch (name) {
      case "paperclip_summary":
        return wrap(await paperclipSummary());
      case "paperclip_list_issues":
        return wrap(await listIssues({ status: s(args.status), search: s(args.search), limit: n(args.limit) }));
      case "paperclip_create_issue":
        return wrap(await createIssue({ title: s(args.title) || "New issue", description: s(args.description), status: s(args.status), priority: s(args.priority), assignee: s(args.assignee) }));
      case "paperclip_update_issue": {
        const item = await updateIssue(s(args.id) || "", { title: s(args.title), status: s(args.status), priority: s(args.priority), assignee: s(args.assignee), comment: s(args.comment) });
        return item ? wrap(item) : JSON.stringify({ ok: false, error: "issue not found" });
      }
      case "paperclip_checkout_issue": {
        const item = await checkoutIssue(s(args.id) || "", s(args.agentId));
        return item ? wrap(item) : JSON.stringify({ ok: false, error: "issue not found" });
      }
      case "paperclip_add_comment": {
        const result = await addComment(s(args.id) || "", s(args.body) || "");
        return result.ok ? wrap(result) : JSON.stringify({ ok: false, error: "issue not found" });
      }
      default:
        return JSON.stringify({ ok: false, error: `unknown paperclip tool ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ ok: false, error: String(e).slice(0, 160) });
  }
}

export async function paperclipDiagnostics(): Promise<{
  mode: "live" | "mock";
  baseUrl: string;
  companyId?: string;
  probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[];
}> {
  const baseUrl = paperclipBaseUrl();
  const companyId = paperclipCompanyId();
  if (!paperclipConfigured()) {
    return { mode: "mock", baseUrl, companyId, probes: [{ endpoint: "(none)", ok: false, error: "Set API URL + API key + company ID in Settings → Connectors → Paperclip" }] };
  }
  const probes: { endpoint: string; ok: boolean; status?: number; count?: number; sampleFields?: string[]; error?: string }[] = [];
  const healthPath = "/api/health";
  try {
    const res = await fetch(`${baseUrl}${healthPath}`, { signal: AbortSignal.timeout(8000) });
    probes.push({ endpoint: healthPath, ok: res.ok, status: res.status });
  } catch (e) {
    probes.push({ endpoint: healthPath, ok: false, error: String(e).slice(0, 100) });
  }
  const issuesPath = `/api/companies/${companyId}/issues`;
  try {
    const res = await fetch(`${baseUrl}${issuesPath}`, { headers: authHeaders(), signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      probes.push({ endpoint: issuesPath, ok: false, status: res.status });
    } else {
      const json = await res.json();
      const arr = unwrapArray<Record<string, unknown>>(json, "issues");
      probes.push({ endpoint: issuesPath, ok: true, status: res.status, count: arr.length, sampleFields: arr[0] ? Object.keys(arr[0]).slice(0, 20) : [] });
    }
  } catch (e) {
    probes.push({ endpoint: issuesPath, ok: false, error: String(e).slice(0, 100) });
  }
  return { mode: "live", baseUrl, companyId, probes };
}
