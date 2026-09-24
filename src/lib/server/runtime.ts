import { EventEmitter } from "node:events";
import type {
  AgentMessage, AgentRuntimeInfo, BreakerState, Connector, DeptId,
  MemoryEntry, OfficeEvent, OfficeSnapshot, Routine, RunMode, Task,
} from "../types";
import {
  AGENTS, AGENTS_BY_DEPT, DEPARTMENTS, JARVIS, OFFICE_NAME,
  agentById, leadForDept,
} from "../office-data";
import { shortId } from "../utils";
import { loadConfig } from "./config";
import { claudePrompt, claudeStatus } from "./claude";
import { getConnectors, connectorsForDept } from "./mcp";
import { retrieve, writeDeliverable } from "./brain";
import { skillsForAgent } from "./skills";
import { parseCadence } from "./when";
import {
  createDeal, listDeals, pipelineSummary, twentyConfigured, updateDeal, type DealStage,
} from "./twenty";
import {
  bigcapitalConfigured, createBill, createInvoice, financeSummary,
  listInvoices, recordPayment, reconcilePayment, updateInvoice,
} from "./bigcapital";
import {
  createWorkItem, listWorkItems, planeConfigured, pmSummary, updateWorkItem, type StateGroup,
} from "./plane";
import { createPost, socialSummary, trypostConfigured } from "./trypost";
import {
  createEmail, emailSummary, listEmails, mauticConfigured, sendEmail,
} from "./mautic";

interface AgentRT { used: number; limit: number; breaker: BreakerState; }
interface RuntimeState {
  bus: EventEmitter; tasks: Map<string, Task>; routines: Routine[]; connectors: Connector[];
  messages: AgentMessage[]; memory: MemoryEntry[]; agentRT: Map<string, AgentRT>;
  mode: RunMode; modeReason: string; started: boolean; clock?: NodeJS.Timeout;
}

const g = globalThis as unknown as { __orbit?: RuntimeState };

function state(): RuntimeState {
  if (!g.__orbit) {
    const bus = new EventEmitter();
    bus.setMaxListeners(200);
    g.__orbit = { bus, tasks: new Map(), routines: [], connectors: [], messages: [], memory: [], agentRT: new Map(), mode: "demo", modeReason: "starting…", started: false };
  }
  const o = g.__orbit;
  if (!o.messages) o.messages = [];
  if (!o.memory) o.memory = [];
  if (!o.agentRT) o.agentRT = new Map();
  return o;
}

const DEFAULT_BUDGET = 100;
function agentRT(id: string): AgentRT {
  const s = state();
  let rt = s.agentRT.get(id);
  if (!rt) { rt = { used: 0, limit: DEFAULT_BUDGET, breaker: "ok" }; s.agentRT.set(id, rt); }
  return rt;
}
function breakerFor(used: number, limit: number): BreakerState {
  const r = used / limit;
  if (r >= 1) return "stopped";
  if (r >= 0.85) return "constrain";
  if (r >= 0.6) return "steer";
  return "ok";
}
function spendBudget(agentId: string, amount: number) {
  const rt = agentRT(agentId);
  rt.used = Math.min(rt.limit, rt.used + amount);
  rt.breaker = breakerFor(rt.used, rt.limit);
  emit({ type: "agent", agent: { id: agentId, ...rt } });
}
export function resetBudget(agentId: string): AgentRuntimeInfo {
  const rt = agentRT(agentId);
  rt.used = 0; rt.breaker = "ok";
  emit({ type: "agent", agent: { id: agentId, ...rt } });
  return { id: agentId, ...rt };
}
function agentsSnapshot(): AgentRuntimeInfo[] {
  return AGENTS.map((a) => { const rt = agentRT(a.id); return { id: a.id, used: rt.used, limit: rt.limit, breaker: rt.breaker }; });
}
const OUTBOUND = /\b(send|email|reply|post|publish|pay|invoice|text|message|dm|tweet|schedule a call|book)\b/i;
export function subscribe(fn: (e: OfficeEvent) => void): () => void {
  const s = state(); s.bus.on("event", fn); return () => s.bus.off("event", fn);
}
function emit(e: OfficeEvent) { state().bus.emit("event", e); }

export async function ensureStarted() {
  const s = state();
  if (s.started) return;
  s.started = true;
  const cfg = loadConfig();
  const status = await claudeStatus();
  s.mode = status.available ? "live" : "demo";
  s.modeReason = status.reason;
  s.connectors = await getConnectors(status.available);
  if (s.tasks.size === 0) seedDemo(cfg.model);
  seedRoutines();
  startClock();
}
export async function getSnapshot(): Promise<OfficeSnapshot> {
  await ensureStarted();
  const s = state();
  const cfg = loadConfig();
  return {
    name: OFFICE_NAME, mode: s.mode, modeReason: s.modeReason, model: cfg.model,
    connectors: s.connectors,
    tasks: [...s.tasks.values()].sort((a, b) => b.createdAt - a.createdAt),
    routines: s.routines, agents: agentsSnapshot(), usage: { session: 18, week: 42 },
  };
}
export function sendMessage(from: string, to: string, body: string, taskId?: string): AgentMessage {
  const s = state();
  const msg: AgentMessage = { id: shortId("m"), from, to, body, ts: Date.now(), read: false, taskId };
  s.messages.push(msg);
  if (s.messages.length > 500) s.messages = s.messages.slice(-500);
  emit({ type: "message", message: msg });
  return msg;
}
export function addMemory(agentId: string, text: string): MemoryEntry {
  const s = state();
  const entry: MemoryEntry = { id: shortId("mem"), agentId, text, ts: Date.now() };
  s.memory.push(entry);
  if (s.memory.length > 1000) s.memory = s.memory.slice(-1000);
  return entry;
}
export function getHive() { const s = state(); return { messages: s.messages, memory: s.memory }; }
export function markRead(agentId: string) { const s = state(); for (const m of s.messages) if (m.to === agentId) m.read = true; }
export async function refreshMode() {
  const s = state();
  const status = await claudeStatus(true);
  s.mode = status.available ? "live" : "demo";
  s.modeReason = status.reason;
  s.connectors = await getConnectors(status.available);
  emit({ type: "snapshot", snapshot: await getSnapshot() });
}
function heuristicAgent(dept: DeptId, title: string): string {
  const roster = AGENTS_BY_DEPT[dept];
  const t = title.toLowerCase();
  let best = roster.find((a) => !a.lead) ?? roster[0];
  let bestScore = -1;
  for (const a of roster) {
    const hay = (a.name + " " + a.role + " " + a.does).toLowerCase();
    let score = 0;
    for (const term of t.split(/\W+/)) { if (term.length > 3 && hay.includes(term)) score += 1; }
    if (a.lead) score -= 0.5;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best.id;
}
async function routeAgent(dept: DeptId, title: string): Promise<string> {
  const s = state();
  if (s.mode === "live") {
    const roster = AGENTS_BY_DEPT[dept].map((a) => `${a.id}: ${a.name} — ${a.does}${a.lead ? " (department lead)" : ""}`).join("\n");
    const prompt = `You are ${JARVIS.name}, the ${JARVIS.role} of an AI office — every agent reports to you. Working through the ${dept} department lead, pick the single best agent id to own this task.\nTask: "${title}"\nAgents:\n${roster}\nReply with only the agent id.`;
    const out = await claudePrompt(prompt, 30000);
    if (out) {
      const id = out.trim().split(/\s|\n/)[0].replace(/[^a-z_]/gi, "");
      if (AGENTS_BY_DEPT[dept].some((a) => a.id === id)) return id;
    }
  }
  return heuristicAgent(dept, title);
}
export async function createTask(title: string, dept: DeptId, opts: { model?: string; scheduled?: boolean; routineId?: string; deps?: string[]; origin?: Task["origin"]; agentId?: string; } = {}): Promise<Task> {
  await ensureStarted();
  const s = state();
  const cfg = loadConfig();
  const agentId = opts.agentId || (await routeAgent(dept, title));
  const agent = agentById(agentId)!;
  const outbound = OUTBOUND.test(title);
  const deps = (opts.deps || []).filter((d) => s.tasks.has(d));
  const blocked = deps.some((d) => { const dep = s.tasks.get(d); return dep && dep.status !== "done"; });
  const task: Task = {
    id: shortId(), title, dept, agentId, agentName: agent.name,
    status: blocked ? "blocked" : "backlog", progress: 0, mode: s.mode,
    model: opts.model || cfg.model, createdAt: Date.now(), updatedAt: Date.now(),
    toolsUsed: [], scheduled: opts.scheduled, routineId: opts.routineId,
    outbound, needsApproval: outbound, deps, origin: opts.origin || "user",
  };
  s.tasks.set(task.id, task);
  emit({ type: "task", task });
  if (!blocked) void runTask(task.id);
  return task;
}
function startUnblocked() {
  const s = state();
  for (const task of s.tasks.values()) {
    if (task.status !== "blocked") continue;
    const ready = (task.deps || []).every((d) => s.tasks.get(d)?.status === "done");
    if (ready) { update(task.id, { status: "backlog" }); void runTask(task.id); }
  }
}
function update(id: string, patch: Partial<Task>) {
  const s = state();
  const task = s.tasks.get(id);
  if (!task) return;
  Object.assign(task, patch, { updatedAt: Date.now() });
  emit({ type: "task", task });
}
async function runTask(id: string) {
  const s = state();
  const task = s.tasks.get(id);
  if (!task) return;
  const agent = agentById(task.agentId)!;
  const rt = agentRT(task.agentId);
  if (rt.breaker === "stopped") {
    update(id, { status: "stopped", progress: 0 });
    sendMessage(task.agentId, "jarvis", `Circuit breaker stopped "${task.title}" — budget exhausted. Reset the budget to resume.`, id);
    return;
  }
  const allowed = connectorsForDept(s.connectors, task.dept).map((c) => c.key);
  update(id, { status: "in_progress", progress: 8 });
  for (const key of allowed.slice(0, 2)) { setTimeout(() => emit({ type: "connector_pulse", key }), 400); }
  const ramp = [18, 32, 46, 60, 72, 84, 92];
  for (const p of ramp) {
    await sleep(1100 + Math.random() * 700);
    if (!s.tasks.get(id)) return;
    update(id, { progress: p });
  }
  let deliverable = "";
  const reads = retrieve(task.title, 3);
  const readTitles = reads.map((r) => r.title);
  if (s.mode === "live") {
    deliverable = (await liveWork(task, agent.does, readTitles)) || demoDeliverable(task, agent.role);
  } else {
    await sleep(500);
    deliverable = demoDeliverable(task, agent.role);
  }
  const usedTools = allowed.slice(0, 2);
  if (task.dept === "sales" && allowed.includes("crm")) {
    const crm = await crmForTask(task.title);
    if (crm) { deliverable += `\n\n---\n\n### CRM (${twentyConfigured() ? "Twenty — live" : "Twenty — local"})\n${crm}`; if (!usedTools.includes("crm")) usedTools.unshift("crm"); }
  }
  if (task.dept === "finance" && allowed.includes("bigcapital")) {
    const books = await financeForTask(task.title);
    if (books) { deliverable += `\n\n---\n\n### Books (${bigcapitalConfigured() ? "Bigcapital — live" : "Bigcapital — local"})\n${books}`; if (!usedTools.includes("bigcapital")) usedTools.unshift("bigcapital"); }
  }
  if ((task.dept === "ops" || task.dept === "emails") && allowed.includes("plane")) {
    const pm = await pmForTask(task.title, task.dept, agent.name);
    if (pm) { deliverable += `\n\n---\n\n### Projects (${planeConfigured() ? "Plane — live" : "Plane — local"})\n${pm}`; if (!usedTools.includes("plane")) usedTools.unshift("plane"); }
  }
  if (task.dept === "marketing") {
    if (agent.tools.includes("mautic") && allowed.includes("mautic")) {
      const email = await emailForTask(task.title);
      if (email) { deliverable += `\n\n---\n\n### Email (${mauticConfigured() ? "Mautic — live" : "Mautic — local"})\n${email}`; if (!usedTools.includes("mautic")) usedTools.unshift("mautic"); }
    } else if (agent.tools.includes("trypost") && allowed.includes("trypost")) {
      const social = await socialForTask(task.title, agent.name);
      if (social) { deliverable += `\n\n---\n\n### Social (${trypostConfigured() ? "TryPost — live" : "TryPost — local"})\n${social}`; if (!usedTools.includes("trypost")) usedTools.unshift("trypost"); }
    }
  }
  const notePath = writeDeliverable(task.agentName, task.title, deliverable, readTitles);
  spendBudget(task.agentId, 12 + Math.round(Math.random() * 10));
  addMemory(task.agentId, `Completed: ${task.title}`);
  if (task.needsApproval && task.outbound) {
    update(id, { status: "waiting_approval", progress: 100, deliverable, toolsUsed: usedTools, note: notePath || undefined });
    sendMessage(task.agentId, "jarvis", `"${task.title}" is ready but needs your OK before I send it.`, id);
  } else {
    update(id, { status: "done", progress: 100, deliverable, toolsUsed: usedTools, note: notePath || undefined });
    startUnblocked();
  }
}
function parseAmount(text: string): number | undefined {
  const m = text.match(/\$?\s?([\d][\d,]*(?:\.\d+)?)\s*([kmb])?/i);
  if (!m) return undefined;
  let val = Number(m[1].replace(/,/g, ""));
  if (!isFinite(val)) return undefined;
  const suffix = (m[2] || "").toLowerCase();
  if (suffix === "k") val *= 1_000; else if (suffix === "m") val *= 1_000_000; else if (suffix === "b") val *= 1_000_000_000;
  return Math.round(val);
}
const STAGE_ORDER: DealStage[] = ["NEW", "SCREENING", "MEETING", "PROPOSAL", "CUSTOMER"];
async function crmForTask(title: string): Promise<string | null> {
  const t = title.toLowerCase();
  try {
    const wantsCreate = /\b(create|open|add|log|new|start)\b/.test(t) && /\b(deal|opportunity|opp|pipeline|lead)\b/.test(t);
    const wantsWin = /\b(close|closed|won|win|signed|handoff|hand off|warm transfer)\b/.test(t);
    const wantsAdvance = /\b(advance|move|progress|next stage|update)\b/.test(t);
    if (wantsCreate) {
      const amount = parseAmount(title);
      const deal = await createDeal({ name: title.replace(/\s+/g, " ").trim().slice(0, 80), amount, stage: "NEW", closeDate: new Date(Date.now() + 30 * 864e5).toISOString() });
      return `Created deal **${deal.name}** (${deal.id}) at stage ${deal.stage}${deal.amount ? ` · $${deal.amount.toLocaleString()}` : ""}.`;
    }
    if (wantsWin || wantsAdvance) {
      const deals = await listDeals({ limit: 100 });
      const terms = t.split(/\W+/).filter((w) => w.length > 3);
      const match = deals.find((d) => terms.some((w) => d.name.toLowerCase().includes(w) || (d.companyName || "").toLowerCase().includes(w))) || deals[0];
      if (match) {
        const nextStage = wantsWin ? "CUSTOMER" : STAGE_ORDER[Math.min(STAGE_ORDER.indexOf(match.stage) + 1, STAGE_ORDER.length - 1)];
        const updated = await updateDeal(match.id, { stage: nextStage });
        if (updated) {
          const won = nextStage === "CUSTOMER";
          return `Moved deal **${updated.name}** (${updated.id}) to **${updated.stage}**${won ? " — closed/won, ready to warm-transfer to Account Management." : "."}`;
        }
      }
    }
    const summary = await pipelineSummary();
    const lines = summary.filter((s) => s.count > 0).map((s) => `- ${s.stage}: ${s.count} deal(s) · $${s.value.toLocaleString()}`);
    const total = summary.reduce((a, b) => a + b.value, 0);
    return `Pipeline snapshot:\n${lines.join("\n")}\n- **Total pipeline:** $${total.toLocaleString()}`;
  } catch { return null; }
}
function money(n: number): string { return `$${Math.round(n).toLocaleString()}`; }
async function financeForTask(title: string): Promise<string | null> {
  const t = title.toLowerCase();
  try {
    const amount = parseAmount(title) || 0;
    const isBill = /\b(bill|payable|vendor|supplier|contractor|expense)\b/.test(t);
    const wantsCreate = /\b(raise|create|issue|new|draft|add|record|enter)\b/.test(t);
    const wantsPay = /\b(pay|paid|payment|settle|remit)\b/.test(t);
    const wantsReconcile = /\b(reconcile|reconciliation|match|bank)\b/.test(t);
    const wantsChase = /\b(overdue|chase|remind|aging|outstanding|unpaid)\b/.test(t);
    if (wantsReconcile) {
      const pay = await reconcilePayment();
      if (pay) return `Reconciled payment **${pay.reference || pay.id}** — ${money(pay.amount)} ${pay.type} from/to ${pay.party}.`;
      return "Nothing left to reconcile — all payments matched.";
    }
    if (wantsCreate && isBill) {
      const vendor = extractParty(title) || "Vendor";
      const bill = await createBill({ vendorName: vendor, amount });
      return `Recorded bill **${bill.billNo}** for ${vendor} — ${money(bill.amount)} (status ${bill.status}).`;
    }
    if (wantsCreate && /\binvoice\b/.test(t)) {
      const customer = extractParty(title) || "Customer";
      const inv = await createInvoice({ customerName: customer, amount });
      return `Raised invoice **${inv.invoiceNo}** for ${customer} — ${money(inv.amount)} (status ${inv.status}).`;
    }
    if (wantsPay) {
      const invoices = await listInvoices({ limit: 100 });
      const terms = t.split(/\W+/).filter((w) => w.length > 3);
      const match = invoices.find((i) => i.status !== "PAID" && i.status !== "DRAFT" && terms.some((w) => i.customerName.toLowerCase().includes(w))) || invoices.find((i) => i.status === "OVERDUE") || invoices.find((i) => i.status !== "PAID" && i.status !== "DRAFT");
      if (match) { await updateInvoice(match.id, { status: "PAID" }); return `Recorded payment for invoice **${match.invoiceNo}** (${match.customerName}) — ${money(match.amount)} marked PAID.`; }
      const pay = await recordPayment({ type: "received", party: extractParty(title) || "Customer", amount });
      return `Recorded a payment received — ${money(pay.amount)} from ${pay.party}.`;
    }
    if (wantsChase) {
      const overdue = await listInvoices({ status: "OVERDUE", limit: 50 });
      if (overdue.length) { const lines = overdue.map((i) => `- ${i.invoiceNo} · ${i.customerName} · ${money(i.amount)}`); return `Overdue invoices to chase (${overdue.length}):\n${lines.join("\n")}`; }
      return "No overdue invoices — AR is current.";
    }
    const sum = await financeSummary();
    return [`Books snapshot:`, `- Cash position: ${money(sum.cash)}`, `- AR outstanding: ${money(sum.arOutstanding)} · AP owed: ${money(sum.apOwed)}`, `- Revenue: ${money(sum.revenue)} · Expenses: ${money(sum.expenses)} · **Net: ${money(sum.net)}**`, `- Overdue invoices: ${sum.overdueCount} · Unreconciled payments: ${sum.unreconciled}`].join("\n");
  } catch { return null; }
}
async function pmForTask(title: string, dept: DeptId, agentName: string): Promise<string | null> {
  const t = title.toLowerCase();
  try {
    const wantsCreate = /\b(create|add|open|plan|new|log|file|raise)\b/.test(t) && /\b(task|ticket|issue|work item|work-item|story|project|backlog)\b/.test(t);
    const wantsDone = /\b(done|complete|completed|finish|finished|ship|shipped|close|closed)\b/.test(t);
    const wantsStart = /\b(start|begin|pick up|in progress|working on|wip)\b/.test(t);
    if (wantsCreate) {
      const stateGroup: StateGroup = dept === "emails" ? "backlog" : "unstarted";
      const item = await createWorkItem({ name: title.replace(/\s+/g, " ").trim().slice(0, 90), priority: /\burgent|asap|critical\b/.test(t) ? "urgent" : /\bhigh\b/.test(t) ? "high" : "medium", stateGroup, assignee: agentName });
      return `Created work item **${item.sequenceId}** — "${item.name}" in ${item.projectName} (${item.stateLabel}, ${item.priority}).`;
    }
    if (wantsDone || wantsStart) {
      const items = await listWorkItems({ limit: 200 });
      const terms = t.split(/\W+/).filter((w) => w.length > 3);
      const open = items.filter((w) => w.stateGroup !== "completed" && w.stateGroup !== "cancelled");
      const match = open.find((w) => terms.some((k) => w.name.toLowerCase().includes(k) || w.sequenceId.toLowerCase().includes(k))) || open.find((w) => (dept === "ops" ? w.stateGroup === "started" || w.stateGroup === "unstarted" : true)) || open[0];
      if (match) {
        const target: StateGroup = wantsDone ? "completed" : "started";
        const updated = await updateWorkItem(match.id, { stateGroup: target });
        if (updated) return `Moved work item **${updated.sequenceId}** — "${updated.name}" to **${updated.stateLabel}**.`;
      }
    }
    const sum = await pmSummary();
    const lines = sum.byState.filter((s) => s.count > 0).map((s) => `- ${s.label}: ${s.count}`);
    return [`Project board snapshot (${sum.totalProjects} projects, ${sum.totalItems} work items):`, ...lines, sum.urgent ? `- **Urgent:** ${sum.urgent}` : ""].filter(Boolean).join("\n");
  } catch { return null; }
}
async function socialForTask(title: string, agentName: string): Promise<string | null> {
  const t = title.toLowerCase();
  try {
    const wantsPublish = /\b(publish|post now|go live|send it)\b/.test(t);
    const wantsSchedule = /\b(schedule|queue|line up|book)\b/.test(t);
    const wantsCreate = /\b(draft|write|create|compose|post|tweet|announce|share)\b/.test(t);
    const platforms: string[] = [];
    for (const [re, name] of [[/\b(x|twitter|tweet)\b/, "X"], [/\blinkedin\b/, "LinkedIn"], [/\binstagram|insta|ig\b/, "Instagram"], [/\bbluesky|bsky\b/, "Bluesky"], [/\bthreads\b/, "Threads"], [/\bfacebook|fb\b/, "Facebook"]] as [RegExp, string][]) {
      if (re.test(t)) platforms.push(name);
    }
    if (wantsCreate || wantsPublish || wantsSchedule) {
      const status = wantsPublish ? "PUBLISHED" : wantsSchedule ? "SCHEDULED" : "DRAFT";
      const post = await createPost({ content: title.replace(/\s+/g, " ").trim(), platforms: platforms.length ? platforms : undefined, status, scheduledAt: status === "SCHEDULED" ? new Date(Date.now() + 864e5).toISOString() : null, author: agentName });
      const where = post.platforms.join(", ");
      return `Created **${post.status.toLowerCase()}** post (${post.id})${where ? ` for ${where}` : ""}: “${post.content.slice(0, 80)}”.`;
    }
    const sum = await socialSummary();
    const lines = sum.byState.filter((s) => s.count > 0).map((s) => `- ${s.label}: ${s.count}`);
    return [`Content calendar (${sum.activeChannels}/${sum.channels} channels active, ${sum.totalPosts} posts):`, ...lines, `- **Scheduled next 7 days:** ${sum.scheduledNext7}`].join("\n");
  } catch { return null; }
}
async function emailForTask(title: string): Promise<string | null> {
  const t = title.toLowerCase();
  try {
    const wantsSend = /\b(send|blast|deliver|broadcast)\b/.test(t);
    const wantsCreate = /\b(draft|write|create|compose|build|new)\b/.test(t) && /\b(email|newsletter|campaign|blast|note)\b/.test(t);
    if (wantsCreate) {
      const email = await createEmail({ name: title.replace(/\s+/g, " ").trim().slice(0, 90) });
      return `Created draft email **${email.name}** (${email.id}) — subject “${email.subject}”.`;
    }
    if (wantsSend) {
      const emails = await listEmails({ limit: 100 });
      const terms = t.split(/\W+/).filter((w) => w.length > 3);
      const draft = emails.find((e) => e.status === "DRAFT" && terms.some((k) => e.name.toLowerCase().includes(k) || e.subject.toLowerCase().includes(k))) || emails.find((e) => e.status === "DRAFT");
      if (draft) { const sent = await sendEmail(draft.id); if (sent) return `Sent **${sent.name}** to ${sent.segment || "its segment"} — ${sent.sentCount.toLocaleString()} recipients.`; }
    }
    const sum = await emailSummary();
    return [`Email snapshot:`, `- Emails: ${sum.totalEmails} (${sum.sent} sent, ${sum.drafts} draft)`, `- Total sent: ${sum.totalSent.toLocaleString()} · Avg open rate: ${sum.avgOpenRate}%`, `- Campaigns: ${sum.campaigns} · Contacts: ${sum.contacts.toLocaleString()}`].join("\n");
  } catch { return null; }
}
function extractParty(title: string): string | null {
  const m = title.match(/\b(?:for|from|to)\s+([A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3})/);
  return m ? m[1].replace(/\s+(worth|at|of|for|due).*$/i, "").trim() : null;
}
async function liveWork(task: Task, does: string, readTitles: string[]): Promise<string | null> {
  const cfg = loadConfig();
  const s = state();
  const skills = skillsForAgent(task.agentId, task.dept);
  const notes = retrieve(task.title, 3).map((d) => `## ${d.title}\n${d.content.slice(0, 800)}`).join("\n\n");
  const skillText = skills.map((sk) => `### Skill: ${sk.name}\n${sk.body.slice(0, 1200)}`).join("\n\n");
  const allowedServers = connectorsForDept(s.connectors, task.dept).map((c) => c.name).join(", ");
  const prompt = [
    `You are ${task.agentName}, the ${does} at ${cfg.studio}.`,
    `Standing rule: read freely; send, post, pay, delete or change anything outside this machine ONLY when the task explicitly asks for that exact action.`,
    allowedServers ? `Connectors you may use: ${allowedServers}.` : "",
    skillText ? `Follow these skills:\n${skillText}` : "",
    notes ? `Relevant notes from the Brain:\n${notes}` : "",
    readTitles.length ? `You read: ${readTitles.join(", ")}.` : "",
    `Task: ${task.title}`,
    `Produce the finished deliverable in Markdown. Be concise and specific.`,
  ].filter(Boolean).join("\n\n");
  return claudePrompt(prompt, 120000);
}
export function actOnTask(id: string, action: "approve" | "reject"): Task | null {
  const s = state();
  const task = s.tasks.get(id);
  if (!task) return null;
  if (action === "approve") { update(id, { status: "done", needsApproval: false }); startUnblocked(); }
  else { update(id, { status: "rejected" }); }
  return s.tasks.get(id) || null;
}
function pickDept(text: string): DeptId {
  const t = text.toLowerCase();
  let best: DeptId = "ops"; let bestScore = -1;
  for (const d of DEPARTMENTS) {
    const hay = (d.name + " " + AGENTS_BY_DEPT[d.id].map((a) => a.role + " " + a.does).join(" ")).toLowerCase();
    let score = 0;
    for (const term of t.split(/\W+/)) { if (term.length > 3 && hay.includes(term)) score += 1; }
    if (score > bestScore) { bestScore = score; best = d.id; }
  }
  return best;
}
export interface JarvisResult { reply: string; tasks: Task[]; }
export async function jarvisRoute(instruction: string): Promise<JarvisResult> {
  await ensureStarted();
  const clean = instruction.trim();
  if (!clean) return { reply: "Tell me what you need and I'll route it.", tasks: [] };
  sendMessage("you", "jarvis", clean);
  const steps = clean.split(/\s*(?:,?\s*(?:and\s+)?then\s+|;\s*|\s+->\s+|\s+then\s+)\s*/i).map((x) => x.trim()).filter(Boolean);
  const created: Task[] = [];
  let prevId: string | undefined;
  for (const step of steps.length ? steps : [clean]) {
    const dept = pickDept(step);
    const task = await createTask(step, dept, { origin: "jarvis", deps: prevId ? [prevId] : undefined });
    created.push(task); prevId = task.id;
  }
  const lines = created.map((t, i) => {
    const dep = t.deps && t.deps.length ? " (after the previous step)" : "";
    const lead = leadForDept(t.dept);
    const via = lead ? ` via ${lead.name}` : "";
    return `${i + 1}. ${t.agentName} · ${t.dept}${via} — "${t.title}"${dep}`;
  });
  const escalations = created.filter((t) => t.needsApproval).length;
  const reply = `On it — ${JARVIS.role} here. I've assigned ${created.length} ${created.length === 1 ? "task" : "tasks"} through the department leads:\n` + lines.join("\n") + (escalations ? `\n\n${escalations} will come back to you for approval before anything goes out.` : "");
  sendMessage("jarvis", "you", reply);
  return { reply, tasks: created };
}
export function addRoutine(title: string, dept: DeptId, cadenceText: string): Routine | null {
  const parsed = parseCadence(cadenceText);
  if (!parsed) return null;
  const s = state();
  const routine: Routine = { id: shortId("r"), title, dept, cadence: parsed.cadence, nextRun: parsed.nextRun, paused: false, needsApproval: OUTBOUND.test(title) };
  s.routines.push(routine);
  emit({ type: "routine", routine });
  return routine;
}
export function mutateRoutine(id: string, action: "pause" | "resume" | "run" | "delete"): Routine[] {
  const s = state();
  const r = s.routines.find((x) => x.id === id);
  if (!r) return s.routines;
  if (action === "delete") { s.routines = s.routines.filter((x) => x.id !== id); }
  else if (action === "pause") { r.paused = true; emit({ type: "routine", routine: r }); }
  else if (action === "resume") { r.paused = false; emit({ type: "routine", routine: r }); }
  else if (action === "run") { r.lastRun = Date.now(); void createTask(r.title, r.dept, { scheduled: true, routineId: r.id }); emit({ type: "routine", routine: r }); }
  return s.routines;
}
function startClock() {
  const s = state();
  if (s.clock) return;
  s.clock = setInterval(() => {
    const now = Date.now();
    for (const r of s.routines) {
      if (r.paused) continue;
      if (r.nextRun <= now) {
        r.lastRun = now;
        const parsed = parseCadence(r.cadence);
        r.nextRun = parsed ? parsed.nextRun : now + 24 * 3600 * 1000;
        void createTask(r.title, r.dept, { scheduled: true, routineId: r.id });
        emit({ type: "routine", routine: r });
      }
    }
  }, 5000);
  if (typeof s.clock.unref === "function") s.clock.unref();
}
function seedRoutines() {
  const s = state();
  if (s.routines.length) return;
  addRoutine("Triage the inbox and tell me what needs me", "emails", "every weekday at 8am");
  addRoutine("List overdue invoices and draft the reminders", "finance", "every Monday at 9am");
  addRoutine("Weekly competitor pricing scan", "marketing", "every Monday at 7am");
}
function seedDemo(model: string) {
  const s = state();
  const seeds: [string, DeptId, number][] = [
    ["Data retention check across 3 systems", "ops", 12], ["Verify mobiles on the AU batch", "sales", 16],
    ["Refresh the fatigued ad set", "marketing", 21], ["Rebuild the welcome sequence, email 2", "emails", 27],
    ["Weekly competitor pricing scan", "marketing", 32], ["Weekly dashboard health check", "ops", 30],
    ["Monthly KPI roll-up", "ops", 40], ["Tighten the ICP with Prospector", "sales", 33],
    ["Draft the Q3 client report", "delivery", 55], ["Reconcile the Stripe payouts", "finance", 70],
    ["Chase the Harbourside follow-up", "sales", 100], ["Weekly numbers circulated to the team", "emails", 100],
  ];
  const now = Date.now();
  seeds.forEach(([title, dept, progress], i) => {
    const agentId = heuristicAgent(dept, title);
    const agent = agentById(agentId)!;
    const status: Task["status"] = progress >= 100 ? "done" : progress > 0 ? "in_progress" : "backlog";
    const t: Task = { id: shortId(), title, dept, agentId, agentName: agent.name, status, progress, mode: s.mode, model, createdAt: now - (seeds.length - i) * 60000, updatedAt: now - i * 30000, toolsUsed: [] };
    s.tasks.set(t.id, t);
  });
}
function demoDeliverable(task: Task, role: string): string {
  return [`**${task.title}**`, ``, `Handled by the ${role}. This is a demo deliverable — with Claude Code logged in on this machine, the ${role} would do the real work here, grounded in your Brain notes and using the connectors wired to ${task.dept}.`, ``, `- Reviewed the relevant notes in the Brain.`, `- Drafted the output in the house format.`, `- Flagged anything that needs your eyes.`, ``, `_Run in demo mode. Model: ${task.model}._`].join("\n");
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
