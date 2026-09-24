import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";

export interface VaultCommand {
  id: string;
  label: string;
  instruction: string;
}

export interface VaultChannel {
  id: string;
  label: string;
  value: string;
  delta: string;
}

export interface VaultConfig {
  commands: VaultCommand[];
  channels: VaultChannel[];
}

const DEFAULTS: VaultConfig = {
  commands: [
    { id: "c1", label: "Metrics Pull", instruction: "Pull this week's metrics across every department and summarize the movement." },
    { id: "c2", label: "Morning Report", instruction: "Prepare the morning report: what shipped, what's in flight, and what needs me." },
    { id: "c3", label: "Inbox Brief", instruction: "Triage the inbox and brief me on what needs my attention." },
    { id: "c4", label: "Trend Scan", instruction: "Scan competitor and market trends and tell me what we should do about it." },
    { id: "c5", label: "Plan Today", instruction: "Plan today's priorities across the office and assign owners." },
    { id: "c6", label: "Plan Tomorrow", instruction: "Plan tomorrow's priorities and pre-stage the work." },
    { id: "c7", label: "Week Review", instruction: "Review the week and summarize what shipped and what slipped." },
    { id: "c8", label: "Content Week", instruction: "Summarize this week's content performance." },
    { id: "c9", label: "Board Cleanup", instruction: "Tidy the task board and close stale or duplicate items." },
    { id: "c10", label: "Client Update", instruction: "Draft the client status updates for the active projects." },
  ],
  channels: [
    { id: "yt", label: "YT Subscribers", value: "135K", delta: "+2.0k /wk" },
    { id: "ig", label: "Instagram", value: "202K", delta: "steady" },
    { id: "video", label: "Latest Video", value: "17K", delta: "+3.5k /day" },
  ],
};

function vaultPath() {
  return path.join(dataDir(), "vault.json");
}

export function loadVaultConfig(): VaultConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(vaultPath(), "utf8"));
    return {
      commands: Array.isArray(raw.commands) ? raw.commands : DEFAULTS.commands,
      channels: Array.isArray(raw.channels) ? raw.channels : DEFAULTS.channels,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveVaultConfig(cfg: VaultConfig): VaultConfig {
  const clean: VaultConfig = {
    commands: (cfg.commands || [])
      .filter((c) => c && c.label)
      .slice(0, 20)
      .map((c, i) => ({
        id: c.id || `c${i}`,
        label: String(c.label).slice(0, 40),
        instruction: String(c.instruction || "").slice(0, 400),
      })),
    channels: (cfg.channels || [])
      .filter((c) => c && c.label)
      .slice(0, 12)
      .map((c, i) => ({
        id: c.id || `ch${i}`,
        label: String(c.label).slice(0, 40),
        value: String(c.value || "").slice(0, 20),
        delta: String(c.delta || "").slice(0, 24),
      })),
  };
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(vaultPath(), JSON.stringify(clean, null, 2));
  } catch {
    /* read-only fs */
  }
  return clean;
}
