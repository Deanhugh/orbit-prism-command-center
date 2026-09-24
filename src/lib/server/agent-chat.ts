import type { AgentConversation, ChatMessage } from "../agents-types";
import { JARVIS, agentById } from "../office-data";
import { loadConfig } from "./config";
import { retrieve } from "./brain";
import { skillsForAgent } from "./skills";
import { toolSchemasForAgent } from "./composio";
import type { ChatMsg, ToolSchema } from "./llm";

export interface ChatOptions {
  mode?: "chat" | "plan" | "task";
  skill?: string;
}

function planLine(mode?: string): string {
  return mode === "plan"
    ? "MODE: PLAN. For this request, produce a clear, numbered step-by-step plan of how you'd do it — do NOT execute anything or call tools. End with what you'd need from the owner to proceed."
    : "";
}

function systemPromptFor(agentId: string, userText: string, opts: ChatOptions = {}): string {
  const cfg = loadConfig();
  if (agentId === "jarvis") {
    return [
      `You are ${JARVIS.name}, the ${JARVIS.role} at ${cfg.studio}. Every department lead and agent reports to you; you report to the owner.`,
      JARVIS.does,
      `When asked to do work, break it into steps, say which agent/department owns each, and flag anything that needs the owner's approval.`,
      planLine(opts.mode),
      `Be concise and direct.`,
    ].filter(Boolean).join("\n\n");
  }
  const a = agentById(agentId);
  if (!a) return `You are a helpful assistant at ${cfg.studio}.`;
  const agentSkills = skillsForAgent(a.id, a.dept);
  const picked = opts.skill ? agentSkills.find((s) => s.name === opts.skill) : undefined;
  const skills = agentSkills
    .map((s) => `### Skill: ${s.name}\n${s.body.slice(0, 1000)}`)
    .join("\n\n");
  const notes = retrieve(userText, 3)
    .map((d) => `## ${d.title}\n${d.content.slice(0, 700)}`)
    .join("\n\n");
  return [
    `You are ${a.name}, the ${a.role} at ${cfg.studio}. ${a.does}`,
    `Standing rule: read freely; send, post, pay, delete or change anything outside this machine ONLY when explicitly asked for that exact action.`,
    a.tools.length ? `Tools you may use: ${a.tools.join(", ")}.` : "",
    picked ? `Apply this skill for this request:\n### Skill: ${picked.name}\n${picked.body.slice(0, 1600)}` : "",
    skills ? `Your other skills:\n${skills}` : "",
    notes ? `Relevant notes from the Brain:\n${notes}` : "",
    planLine(opts.mode),
    `Answer as this agent — concise, specific, in the studio's voice.`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export interface PreparedChat {
  responderId: string;
  responderName: string;
  messages: ChatMsg[];
  tools: ToolSchema[];
}

export function prepareChat(
  conv: AgentConversation,
  responderId: string,
  history: ChatMessage[],
  userText: string,
  opts: ChatOptions = {},
): PreparedChat {
  const responderName = responderId === "jarvis" ? JARVIS.name : agentById(responderId)?.name || "Agent";
  const sys = systemPromptFor(responderId, userText, opts);

  const msgs: ChatMsg[] = [{ role: "system", content: sys }];
  for (const m of history.slice(-12)) {
    msgs.push({ role: m.role === "user" ? "user" : "assistant", content: m.content });
  }
  msgs.push({ role: "user", content: userText });

  const tools = responderId === "jarvis" || opts.mode === "plan" ? [] : toolSchemasForAgent(agentById(responderId)!);
  return { responderId, responderName, messages: msgs, tools };
}
