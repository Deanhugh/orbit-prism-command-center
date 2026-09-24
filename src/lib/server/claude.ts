import { spawn } from "node:child_process";
import { forcedDemo } from "./config";

export interface ClaudeStatus {
  available: boolean;
  reason: string;
  version?: string;
}

let statusCache: { at: number; value: ClaudeStatus } | null = null;

function run(
  cmd: string,
  args: string[],
  input?: string,
  timeoutMs = 20000,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(cmd, args, { env: process.env });
    } catch {
      resolve({ code: -1, stdout: "", stderr: "spawn failed" });
      return;
    }
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        /* ignore */
      }
      resolve({ code: -2, stdout, stderr: stderr + "\n[timeout]" });
    }, timeoutMs);
    child.stdout?.on("data", (d) => (stdout += d.toString()));
    child.stderr?.on("data", (d) => (stderr += d.toString()));
    child.on("error", () => {
      clearTimeout(timer);
      resolve({ code: -1, stdout, stderr: stderr || "error" });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 0, stdout, stderr });
    });
    if (input) {
      child.stdin?.write(input);
      child.stdin?.end();
    }
  });
}

export async function claudeStatus(force = false): Promise<ClaudeStatus> {
  if (forcedDemo()) {
    return { available: false, reason: "ORBIT_MODE=demo (cloud host)" };
  }
  if (!force && statusCache && Date.now() - statusCache.at < 30000) {
    return statusCache.value;
  }
  const res = await run("claude", ["--version"], undefined, 8000);
  let value: ClaudeStatus;
  if (res.code === 0 && res.stdout.trim()) {
    value = {
      available: true,
      reason: "claude CLI logged in",
      version: res.stdout.trim().split("\n")[0],
    };
  } else if (res.code === -1) {
    value = { available: false, reason: "claude CLI not installed on PATH" };
  } else if (res.code === -2) {
    value = { available: false, reason: "claude CLI timed out" };
  } else {
    value = {
      available: false, 
      reason: "claude CLI not logged in",
    };
  }
  statusCache = { at: Date.now(), value };
  return value;
}

/**
 * Run a headless Claude prompt. Returns text or null on failure.
 * Deliberately gives Claude no Bash / file tools — our runtime writes to the
 * Brain after the model returns, it never hands over the filesystem.
 */
export async function claudePrompt(
  prompt: string,
  timeoutMs = 90000,
): Promise<string | null> {
  const res = await run("claude", ["-p", prompt], undefined, timeoutMs);
  if (res.code === 0 && res.stdout.trim()) return res.stdout.trim();
  return null;
}

export async function claudeMcpListRaw(): Promise<string | null> {
  if (forcedDemo()) return null;
  const res = await run("claude", ["mcp", "list"], undefined, 12000);
  if (res.code === 0) return res.stdout;
  return null;
}

export type McpTransport = "stdio" | "sse" | "http";

/** Register an MCP server with Claude Code (`claude mcp add`). */
export async function claudeMcpAdd(
  name: string,
  transport: McpTransport,
  target: string,
  args: string[] = [],
): Promise<{ ok: boolean; ran: boolean; message: string }> {
  if (forcedDemo()) {
    return { ok: false, ran: false, message: "Claude CLI not available here — saved to your connector list; run this on a machine with Claude Code to register it live." };
  }
  const argv = ["mcp", "add"];
  if (transport === "sse" || transport === "http") {
    argv.push("--transport", transport, name, target);
  } else {
    // stdio: everything after `--` is the command + its args
    argv.push(name, "--", target, ...args);
  }
  const res = await run("claude", argv, undefined, 20000);
  const message = (res.stdout || res.stderr || "").trim().slice(0, 240);
  return { ok: res.code === 0, ran: true, message: message || (res.code === 0 ? "Added" : "Failed") };
}

/** Remove an MCP server from Claude Code (`claude mcp remove`). */
export async function claudeMcpRemove(name: string): Promise<{ ok: boolean; ran: boolean; message: string }> {
  if (forcedDemo()) return { ok: false, ran: false, message: "Claude CLI not available here — removed from your connector list." };
  const res = await run("claude", ["mcp", "remove", name], undefined, 15000);
  const message = (res.stdout || res.stderr || "").trim().slice(0, 240);
  return { ok: res.code === 0, ran: true, message: message || (res.code === 0 ? "Removed" : "Failed") };
}
