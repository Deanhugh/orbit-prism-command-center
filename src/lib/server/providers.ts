import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";

export type ProviderId =
  | "lmstudio"
  | "ollama"
  | "xai"
  | "openai"
  | "openrouter"
  | "groq"
  | "together"
  | "claude"
  | "demo";

export interface ProviderDef {
  id: ProviderId;
  label: string;
  defaultBaseUrl?: string;
  keyName?: string;
  local?: boolean;
  openaiCompatible: boolean;
}

export const PRESETS: Record<ProviderId, ProviderDef> = {
  lmstudio: { id: "lmstudio", label: "LM Studio (local)", defaultBaseUrl: "http://localhost:1234/v1", local: true, openaiCompatible: true },
  ollama: { id: "ollama", label: "Ollama (local + Cloud)", defaultBaseUrl: "http://127.0.0.1:11434/v1", keyName: "OLLAMA_API_KEY", local: true, openaiCompatible: true },
  xai: { id: "xai", label: "xAI Grok", defaultBaseUrl: "https://api.x.ai/v1", keyName: "XAI_API_KEY", openaiCompatible: true },
  openai: { id: "openai", label: "OpenAI", defaultBaseUrl: "https://api.openai.com/v1", keyName: "OPENAI_API_KEY", openaiCompatible: true },
  openrouter: { id: "openrouter", label: "OpenRouter", defaultBaseUrl: "https://openrouter.ai/api/v1", keyName: "OPENROUTER_API_KEY", openaiCompatible: true },
  groq: { id: "groq", label: "Groq", defaultBaseUrl: "https://api.groq.com/openai/v1", keyName: "GROQ_API_KEY", openaiCompatible: true },
  together: { id: "together", label: "Together AI", defaultBaseUrl: "https://api.together.xyz/v1", keyName: "TOGETHER_API_KEY", openaiCompatible: true },
  claude: { id: "claude", label: "Claude Code (CLI)", openaiCompatible: false },
  demo: { id: "demo", label: "Demo (no backend)", openaiCompatible: false },
};

export const PROVIDER_IDS = Object.keys(PRESETS) as ProviderId[];

export interface AgentsConfig {
  provider: ProviderId;
  model: string;
  temperature: number;
  composio: boolean;
  baseUrls: Partial<Record<ProviderId, string>>;
}

const DEFAULTS: AgentsConfig = {
  provider: "ollama",
  model: "qwen2.5:7b",
  temperature: 0.6,
  composio: false,
  baseUrls: {},
};

function cfgPath() {
  return path.join(dataDir(), "agents.config.json");
}
function secretsPath() {
  return path.join(dataDir(), "secrets.json");
}

export function loadAgentsConfig(): AgentsConfig {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(cfgPath(), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveAgentsConfig(patch: Partial<AgentsConfig>): AgentsConfig {
  const next = { ...loadAgentsConfig(), ...patch };
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(cfgPath(), JSON.stringify(next, null, 2));
  } catch {
    /* read-only fs */
  }
  return next;
}

function readSecrets(): Record<string, string> {
  try {
    return JSON.parse(fs.readFileSync(secretsPath(), "utf8"));
  } catch {
    return {};
  }
}

export function setSecret(name: string, value: string) {
  const s = readSecrets();
  if (value) s[name] = value;
  else delete s[name];
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(secretsPath(), JSON.stringify(s, null, 2));
  } catch {
    /* read-only fs */
  }
}

export function getSecret(name: string): string | undefined {
  return readSecrets()[name] || process.env[name];
}

export function hasSecret(name: string): boolean {
  return Boolean(getSecret(name));
}

export function baseUrlFor(id: ProviderId): string | undefined {
  const fromEnv = process.env[`${id.toUpperCase()}_BASE_URL`];
  if (fromEnv) return fromEnv;
  const cfg = loadAgentsConfig();
  return cfg.baseUrls[id] || PRESETS[id].defaultBaseUrl;
}

export function apiKeyFor(id: ProviderId): string | undefined {
  const def = PRESETS[id];
  if (def.keyName) {
    const fromStore = getSecret(def.keyName);
    if (fromStore) return fromStore;
  }
  if (def.local) return "local";
  if (!def.keyName) return undefined;
  return undefined;
}

export function providerConfigured(id: ProviderId): boolean {
  if (id === "demo" || id === "claude") return true;
  const def = PRESETS[id];
  if (def.local) return true;
  return Boolean(apiKeyFor(id));
}

export function composioReady(): boolean {
  return hasSecret("COMPOSIO_API_KEY");
}
