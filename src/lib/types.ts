export type DeptId =
  | "marketing"
  | "emails"
  | "delivery"
  | "sales"
  | "ops"
  | "finance";

export type TaskStatus =
  | "backlog"
  | "blocked"
  | "in_progress"
  | "waiting_approval"
  | "done"
  | "rejected"
  | "stopped";

export type BreakerState = "ok" | "steer" | "constrain" | "stopped";

export type RunMode = "live" | "demo";

export interface Agent {
  id: string;
  dept: DeptId;
  lead: boolean;
  name: string;
  role: string;
  does: string;
  tools: string[];
  /** desk index within the pod */
  seat: number;
}

export interface Department {
  id: string;
  name: string;
  accent: string;
  seats: number;
  /** angle position around the Brain, radians */
  angle: number;
  metrics: { label: string; value: string }[];
}

export interface Task {
  id: string;
  title: string;
  dept: DeptId;
  agentId: string;
  agentName: string;
  status: TaskStatus;
  progress: number; // 0..100
  mode: RunMode;
  model: string;
  createdAt: number;
  updatedAt: number;
  toolsUsed: string[];
  deliverable?: string;
  note?: string; // brain note path written
  scheduled?: boolean;
  routineId?: string;
  needsApproval?: boolean;
  outbound?: boolean;
  deps?: string[];
  origin?: "user" | "jarvis" | "routine";
}

export interface AgentMessage {
  id: string;
  from: string; // agent id or "jarvis" or "you"
  to: string; // agent id or "jarvis"
  body: string;
  ts: number;
  read: boolean;
  taskId?: string;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  text: string;
  ts: number;
}

export interface AgentRuntimeInfo {
  id: string;
  used: number;
  limit: number;
  breaker: BreakerState;
}

export interface Connector {
  name: string;
  key: string;
  status: "connected" | "needs_auth" | "denied";
  reason?: string;
  depts: DeptId[];
}

export type RoutineKind = "task" | "brief";
export type BriefKind = "morning" | "evening";

export interface Routine {
  id: string;
  title: string;
  dept: DeptId;
  cadence: string; // human readable
  nextRun: number;
  paused: boolean;
  needsApproval: boolean;
  lastRun?: number;
  kind?: RoutineKind;
  briefKind?: BriefKind;
  timezone?: string;
  hour?: number;
  minute?: number;
}

export interface StoredBrief {
  id: string;
  kind: BriefKind;
  date: string;
  createdAt: number;
  timezone: string;
  owner: string;
  greeting: string;
  narrative: string;
  sections: {
    today: string[];
    waitingOnYou: string[];
    waitingOnThem: string[];
    tomorrow: string[];
    doneToday: string[];
  };
  notePath?: string;
  source: "scheduled" | "on-demand";
}

export interface BrainNode {
  id: string;
  title: string;
  path: string;
  links: string[];
  size: number;
}

export interface OfficeSnapshot {
  name: string;
  mode: RunMode;
  modeReason: string;
  model: string;
  provider?: string;
  providerLabel?: string;
  connectors: Connector[];
  tasks: Task[];
  routines: Routine[];
  briefs: StoredBrief[];
  agents: AgentRuntimeInfo[];
  usage: { session: number; week: number };
}

export type OfficeEvent =
  | { type: "snapshot"; snapshot: OfficeSnapshot }
  | { type: "task"; task: Task }
  | { type: "routine"; routine: Routine }
  | { type: "brief"; brief: StoredBrief }
  | { type: "agent"; agent: AgentRuntimeInfo }
  | { type: "message"; message: AgentMessage }
  | { type: "connector_pulse"; key: string };
