export interface ChatToolStep {
  name: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  agentId?: string;
  agentName?: string;
  tools?: ChatToolStep[];
}

export interface AgentConversation {
  id: string;
  kind: "dm" | "group";
  title: string;
  subtitle: string;
  agentIds: string[]; // roster ids or "jarvis"
  deptId?: string;
  accent: string;
  lastMessage?: string;
  lastTs?: number;
}
