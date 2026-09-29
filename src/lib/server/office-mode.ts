import { forcedDemo } from "./config";
import { PRESETS, apiKeyFor, loadAgentsConfig, type ProviderId } from "./providers";
import { providerStatus } from "./llm";
import type { RunMode } from "../types";

export interface OfficeMode {
  mode: RunMode;
  reason: string;
  provider: ProviderId;
  providerLabel: string;
  model: string;
}

let cache: { at: number; value: OfficeMode } | null = null;

function labelFor(id: ProviderId): string {
  if (id === "openrouter") return "OpenRouter";
  if (id === "ollama") return "Ollama";
  if (id === "claude") return "Claude";
  return PRESETS[id]?.label || id;
}

/**
 * Office live mode follows the configured chat provider (OpenRouter, Ollama Cloud,
 * xAI, …) — not the Claude CLI. Demo / Offline only when ORBIT_MODE=demo, the
 * Demo provider is selected, or the selected backend is unreachable.
 */
export async function resolveOfficeMode(force = false): Promise<OfficeMode> {
  if (!force && cache && Date.now() - cache.at < 15000) return cache.value;

  const cfg = loadAgentsConfig();
  const provider = cfg.provider;
  const model = cfg.model || "";

  let value: OfficeMode;
  if (forcedDemo()) {
    value = {
      mode: "demo",
      reason: "ORBIT_MODE=demo (cloud host)",
      provider,
      providerLabel: labelFor(provider),
      model,
    };
  } else if (provider === "demo") {
    value = {
      mode: "demo",
      reason: "Demo provider selected — pick OpenRouter or Ollama Cloud in Settings",
      provider,
      providerLabel: "Demo",
      model,
    };
  } else {
    const status = await providerStatus(provider);
    if (status.ok) {
      value = {
        mode: "live",
        reason: `${labelFor(provider)} · ${model || "default"} reachable`,
        provider,
        providerLabel: labelFor(provider),
        model,
      };
    } else if (provider !== "openrouter" && apiKeyFor("openrouter")) {
      const or = await providerStatus("openrouter");
      if (or.ok) {
        value = {
          mode: "live",
          reason: `OpenRouter reachable (saved provider ${labelFor(provider)} is not: ${status.reason})`,
          provider: "openrouter",
          providerLabel: "OpenRouter",
          model: model || "openai/gpt-4.1-mini",
        };
      } else {
        value = {
          mode: "demo",
          reason: `${status.reason}; OpenRouter: ${or.reason}`,
          provider,
          providerLabel: labelFor(provider),
          model,
        };
      }
    } else {
      value = {
        mode: "demo",
        reason: status.reason,
        provider,
        providerLabel: labelFor(provider),
        model,
      };
    }
  }

  cache = { at: Date.now(), value };
  return value;
}

export function clearOfficeModeCache() {
  cache = null;
}
