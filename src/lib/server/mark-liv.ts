import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";

export interface SidecarConfig {
  url: string;
  token: string;
}

export interface SidecarLine {
  id: string;
  role: "you" | "jarvis" | "sys";
  text: string;
  ts: number;
}

export interface SidecarStatus {
  url: string;
  running: boolean;
  paired: boolean;
  lastError: string;
  lines: SidecarLine[];
}

const DEFAULT_URL = "http://127.0.0.1:8000";

let listen: WebSocket | null = null;
let listenUrl = "";
let listenToken = "";
const lines: SidecarLine[] = [];

function configPath() {
  return path.join(dataDir(), "mark-liv.json");
}

export function readSidecarConfig(): SidecarConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(configPath(), "utf8")) as Partial<SidecarConfig>;
    return {
      url: sanitizeUrl(String(raw.url || DEFAULT_URL)),
      token: String(raw.token || ""),
    };
  } catch {
    return { url: DEFAULT_URL, token: "" };
  }
}

export function writeSidecarConfig(cfg: SidecarConfig): SidecarConfig {
  const next = { url: sanitizeUrl(cfg.url), token: cfg.token.trim() };
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2));
  if (listen && (listenUrl !== next.url || listenToken !== next.token)) {
    try {
      listen.close();
    } catch {
      /* ignore */
    }
    listen = null;
  }
  return next;
}

export function sanitizeUrl(raw: string): string {
  const trimmed = (raw || DEFAULT_URL).trim().replace(/\/+$/, "");
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("That Mark-LIV address is not a valid URL.");
  }
  const host = parsed.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Mark-LIV must run on this machine. Use localhost or 127.0.0.1.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Mark-LIV URL must start with http:// or https://");
  }
  return parsed.origin;
}

function pushLine(role: SidecarLine["role"], text: string) {
  const clean = text.trim();
  if (!clean) return;
  lines.push({
    id: `ml_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    role,
    text: clean,
    ts: Date.now(),
  });
  if (lines.length > 80) lines.splice(0, lines.length - 80);
}

async function fetchLiv(
  url: string,
  pathName: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<Response> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), init.timeoutMs ?? 2000);
  try {
    return await fetch(`${url}${pathName}`, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export async function probeSidecar(url = readSidecarConfig().url): Promise<{ running: boolean; error: string }> {
  try {
    const res = await fetchLiv(url, "/login", { timeoutMs: 1500 });
    if (res.status > 0) return { running: true, error: "" };
    return { running: false, error: `Mark-LIV answered with HTTP ${res.status}.` };
  } catch (e) {
    const name = e instanceof Error ? e.name : "";
    if (name === "AbortError") return { running: false, error: "Mark-LIV did not answer in time." };
    return { running: false, error: "Mark-LIV is not running on this Mac." };
  }
}

export async function pairSidecar(pin: string): Promise<SidecarStatus> {
  const cfg = readSidecarConfig();
  const probe = await probeSidecar(cfg.url);
  if (!probe.running) {
    return statusFrom(cfg, probe, false);
  }
  const key = pin.trim().toUpperCase();
  if (key.length < 4) throw new Error("Enter the one-time key shown in Mark-LIV (Remote Control).");
  const res = await fetchLiv(cfg.url, "/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin: key }),
    timeoutMs: 4000,
  });
  const data = (await res.json().catch(() => ({}))) as { ok?: boolean; token?: string; error?: string };
  if (!res.ok || !data.token) {
    throw new Error(data.error || "That key was invalid or already used. Press Remote Control in Mark-LIV for a new one.");
  }
  const next = writeSidecarConfig({ url: cfg.url, token: data.token });
  pushLine("sys", "Paired with Mark-LIV on this Mac.");
  ensureListen(next);
  return getSidecarStatus();
}

export async function forgetSidecar(): Promise<SidecarStatus> {
  const cfg = readSidecarConfig();
  writeSidecarConfig({ url: cfg.url, token: "" });
  if (listen) {
    try {
      listen.close();
    } catch {
      /* ignore */
    }
    listen = null;
  }
  pushLine("sys", "Pairing cleared. Mark-LIV is still a separate app on this Mac.");
  return getSidecarStatus();
}

export async function sendSidecarCommand(text: string): Promise<SidecarStatus> {
  const cfg = readSidecarConfig();
  const probe = await probeSidecar(cfg.url);
  if (!probe.running) throw new Error("Mark-LIV is not running. Start it on this Mac, then pair.");
  if (!cfg.token) throw new Error("Not paired yet. Enter the Remote Control key from Mark-LIV.");
  const body = text.trim();
  if (!body) throw new Error("Type something for Jarvis.");
  const res = await fetchLiv(cfg.url, "/api/command", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.token}`,
    },
    body: JSON.stringify({ text: body }),
    timeoutMs: 4000,
  });
  if (res.status === 401) {
    writeSidecarConfig({ url: cfg.url, token: "" });
    throw new Error("Mark-LIV pairing expired. Get a new Remote Control key and pair again.");
  }
  if (!res.ok) throw new Error(`Mark-LIV did not take that command (HTTP ${res.status}).`);
  pushLine("you", body);
  ensureListen(cfg);
  return getSidecarStatus();
}

export async function getSidecarStatus(): Promise<SidecarStatus> {
  const cfg = readSidecarConfig();
  const probe = await probeSidecar(cfg.url);
  if (probe.running && cfg.token) ensureListen(cfg);
  return statusFrom(cfg, probe, Boolean(cfg.token) && probe.running);
}

function statusFrom(
  cfg: SidecarConfig,
  probe: { running: boolean; error: string },
  paired: boolean,
): SidecarStatus {
  return {
    url: cfg.url,
    running: probe.running,
    paired,
    lastError: probe.running ? "" : probe.error,
    lines: [...lines],
  };
}

function ensureListen(cfg: SidecarConfig) {
  if (!cfg.token || listen) return;
  const wsUrl = cfg.url.replace(/^http/, "ws") + `/ws?token=${encodeURIComponent(cfg.token)}`;
  try {
    const ws = new WebSocket(wsUrl);
    listen = ws;
    listenUrl = cfg.url;
    listenToken = cfg.token;
    ws.addEventListener("message", (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as { type?: string; text?: string };
        const text = String(msg.text || "").trim();
        if (!text) return;
        const role = msg.type === "sys" ? "sys" : "jarvis";
        pushLine(role, text);
      } catch {
        /* ignore */
      }
    });
    ws.addEventListener("close", () => {
      if (listen === ws) listen = null;
    });
    ws.addEventListener("error", () => {
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      if (listen === ws) listen = null;
    });
  } catch {
    listen = null;
  }
}
