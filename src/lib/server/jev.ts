import { AGENTS_BY_DEPT, DEPARTMENTS, agentById } from "../office-data";
import type { DeptId } from "../types";
import { apiKeyFor } from "./providers";

export const JEV_MODEL = "typesafe/jev-1.13";
const JEV_URL = "https://openrouter.ai/api/alpha/decisions";
const TOOL_YES_THRESHOLD = 0.8;
const CHOICE_MIN = 0.35;

const DEPT_CRITERIA: Record<DeptId, string> = {
  marketing: "Marketing — social, brand, content, video, scrape, image or video generate, TryPost, Krea, Higgsfield",
  emails: "PMO — tickets, sprints, milestones, Plane, project plans, program management",
  delivery: "Account Management — client accounts, retention, onboarding, renewals, health",
  sales: "Sales — deals, leads, pipeline, CRM, proposals, outbound or inbound",
  ops: "Engineering — agents, code, CAD, IoT, GitHub, Command Centers, integrations",
  finance: "Finance — invoices, bills, books, Stripe, payables, reconciliation",
};

type JevQuestion =
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "noul"; instructions: string; criteria: { true: string; false: string } };

interface JevChoiceAnswer {
  type?: string;
  choice?: string;
  confidence?: number;
  probabilities?: Record<string, number>;
}
interface JevNoulAnswer {
  type?: string;
  noul?: number;
}
type JevAnswer = JevChoiceAnswer & JevNoulAnswer;
interface JevResponse {
  answers?: Record<string, JevAnswer>;
  error?: { message?: string } | string;
}

export function parseChoice(answer: JevAnswer | undefined, allowed: string[]): string | null {
  if (!answer || (answer.type && answer.type !== "choice")) return null;
  const pick = String(answer.choice || "").trim();
  if (!pick || !allowed.includes(pick)) return null;
  const p = answer.probabilities?.[pick];
  const conf = Number(answer.confidence ?? p ?? 1);
  if (Number.isFinite(conf) && conf > 0 && conf < CHOICE_MIN) return null;
  return pick;
}

export function parseNoul(answer: JevAnswer | undefined): number | null {
  if (!answer) return null;
  const n = Number(answer.noul);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

function referer(): string {
  return process.env.ORBIT_PUBLIC_URL || "https://command-center-production-e72e.up.railway.app";
}

export async function askJev(
  state: unknown,
  questions: Record<string, JevQuestion>,
): Promise<Record<string, JevAnswer> | null> {
  const key = apiKeyFor("openrouter");
  if (!key) return null;
  try {
    const res = await fetch(JEV_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": referer(),
        "X-Title": "Orbit Prism Command Center",
      },
      body: JSON.stringify({ model: JEV_MODEL, state, questions }),
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as JevResponse;
    if (!data?.answers || typeof data.answers !== "object") return null;
    return data.answers;
  } catch {
    return null;
  }
}

export async function jevPickDept(title: string): Promise<DeptId | null> {
  const depts = DEPARTMENTS.map((d) => d.id);
  const answers = await askJev(
    { task: title.slice(0, 4000) },
    {
      dept: {
        type: "choice",
        instructions: "Which Orbit Prism department should own this task?",
        criteria: DEPT_CRITERIA,
      },
    },
  );
  return parseChoice(answers?.dept, depts) as DeptId | null;
}

export async function jevRouteTask(title: string): Promise<{ dept: DeptId; agentId: string } | null> {
  const dept = await jevPickDept(title);
  if (!dept) return null;
  const agentId = (await jevPickAgent(dept, title)) || "";
  return { dept, agentId };
}

export async function jevPickAgent(dept: DeptId, title: string): Promise<string | null> {
  const roster = AGENTS_BY_DEPT[dept] || [];
  if (!roster.length) return null;
  const criteria: Record<string, string> = {};
  for (const a of roster) {
    criteria[a.id] = `${a.role} — ${a.does}${a.lead ? " (department lead)" : ""}`.slice(0, 280);
  }
  const answers = await askJev(
    { task: title.slice(0, 4000), department: dept },
    {
      agent: {
        type: "choice",
        instructions: "Which desk should own this task? Prefer a specialist over the department lead unless the work is leadership or portfolio-wide.",
        criteria,
      },
    },
  );
  const id = parseChoice(answers?.agent, roster.map((a) => a.id));
  return id && agentById(id) ? id : null;
}

export async function jevAllowTool(opts: {
  task: string;
  tool: string;
  args?: Record<string, unknown>;
}): Promise<{ allow: boolean; noul: number | null; reason: string }> {
  const argsPreview = JSON.stringify(opts.args || {}).slice(0, 800);
  const answers = await askJev(
    {
      task: opts.task.slice(0, 4000),
      proposed_tool: opts.tool,
      arguments: argsPreview,
    },
    {
      safe: {
        type: "noul",
        instructions: "Is this tool call safe to run without a human approving it first?",
        criteria: {
          true: "Reversible or low-impact, and clearly within the stated task (read, search, list, draft, generate a preview).",
          false: "Destructive, irreversible, sends, posts, pays, deletes, publishes, or is broader than the task requires.",
        },
      },
    },
  );
  if (!answers) return { allow: true, noul: null, reason: "jev unavailable — fail open" };
  const noul = parseNoul(answers.safe);
  if (noul == null) return { allow: true, noul: null, reason: "jev noul missing — fail open" };
  if (noul >= TOOL_YES_THRESHOLD) {
    return { allow: true, noul, reason: `jev noul ${noul.toFixed(2)}` };
  }
  return {
    allow: false,
    noul,
    reason: `Jev blocked ${opts.tool} (yes-probability ${noul.toFixed(2)} < ${TOOL_YES_THRESHOLD}). Do not run it. Write the reply without that side effect and say the owner must approve it.`,
  };
}
