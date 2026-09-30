export interface ChatToolStep {
  name: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface ChatUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  estimated?: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
  agentId?: string;
  agentName?: string;
  tools?: ChatToolStep[];
  usage?: ChatUsage;
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
