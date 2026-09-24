import fs from "node:fs";
import path from "node:path";
import type { AgentConversation, ChatMessage } from "../agents-types";
import { AGENTS, DEPARTMENTS, DEPT_MAP, JARVIS, agentById } from "../office-data";
import { dataDir } from "./config";
import { shortId } from "../utils";

function chatsDir() {
  return path.join(dataDir(), "chats");
}

function fileFor(convId: string) {
  const safe = convId.replace(/[^a-z0-9:_-]/gi, "_");
  return path.join(chatsDir(), `${safe}.json`);
}

/** Build the fixed conversation list from the office roster + Jarvis. */
export function conversationMetas(): AgentConversation[] {
  const list: AgentConversation[] = [];

  // Jarvis DM = "Chief"
  list.push({
    id: "dm:jarvis",
    kind: "dm",
    title: "Chief",
    subtitle: JARVIS.role,
    agentIds: ["jarvis"],
    accent: "#c98a3a",
  });

  // department group threads
  for (const d of DEPARTMENTS) {
    list.push({
      id: `grp:${d.id}`,
      kind: "group",
      title: d.name,
      subtitle: `${AGENTS.filter((a) => a.dept === d.id).length} agents`,
      agentIds: [...AGENTS.filter((a) => a.dept === d.id).map((a) => a.id), "jarvis"],
      deptId: d.id,
      accent: d.accent,
    });
  }

  // per-agent DMs
  for (const a of AGENTS) {
    list.push({
      id: `dm:${a.id}`,
      kind: "dm",
      title: a.name,
      subtitle: a.role,
      agentIds: [a.id],
      deptId: a.dept,
      accent: DEPT_MAP[a.dept].accent,
    });
  }

  return list;
}

export function conversationById(id: string): AgentConversation | undefined {
  return conversationMetas().find((c) => c.id === id);
}

export function getMessages(convId: string): ChatMessage[] {
  try {
    return JSON.parse(fs.readFileSync(fileFor(convId), "utf8"));
  } catch {
    return [];
  }
}

export function appendMessage(convId: string, msg: Omit<ChatMessage, "id" | "ts"> & Partial<Pick<ChatMessage, "id" | "ts">>): ChatMessage {
  const full: ChatMessage = {
    id: msg.id || shortId("c"),
    ts: msg.ts || Date.now(),
    role: msg.role,
    content: msg.content,
    agentId: msg.agentId,
    agentName: msg.agentName,
    tools: msg.tools,
  };
  const all = getMessages(convId);
  all.push(full);
  try {
    fs.mkdirSync(chatsDir(), { recursive: true });
    fs.writeFileSync(fileFor(convId), JSON.stringify(all.slice(-200), null, 2));
  } catch {
    /* read-only fs */
  }
  return full;
}

/** Conversation list with last-message previews for the sidebar. */
export function conversationsWithPreviews(): AgentConversation[] {
  return conversationMetas().map((c) => {
    const msgs = getMessages(c.id);
    const last = msgs[msgs.length - 1];
    return {
      ...c,
      lastMessage: last ? (last.role === "user" ? "You: " : "") + last.content.slice(0, 60) : undefined,
      lastTs: last?.ts,
    };
  });
}

/** Resolve which agent should answer in a conversation (group -> pick by keywords or lead). */
export function resolveResponder(conv: AgentConversation, text: string): string {
  if (conv.kind === "dm") return conv.agentIds[0];
  // group: pick the best-matching member agent by keyword, else the dept lead, else jarvis
  const members = conv.agentIds.filter((id) => id !== "jarvis").map((id) => agentById(id)!).filter(Boolean);
  const t = text.toLowerCase();
  let best = members.find((a) => a.lead) || members[0];
  let bestScore = -1;
  for (const a of members) {
    const hay = (a.name + " " + a.role + " " + a.does).toLowerCase();
    let score = 0;
    for (const term of t.split(/\W+/)) if (term.length > 3 && hay.includes(term)) score += 1;
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best?.id || "jarvis";
}
