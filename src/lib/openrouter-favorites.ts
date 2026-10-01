/** Short OpenRouter list shown at the top of the Agents picker and Settings. */
export interface OpenRouterFavorite {
  id: string;
  label: string;
  hint: string;
}

export const OPENROUTER_FAVORITES: OpenRouterFavorite[] = [
  {
    id: "google/gemini-3.8-flash",
    label: "Gemini Flash",
    hint: "Daily Gemini — fast, long context",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini Pro",
    hint: "Heavier Gemini for harder tasks",
  },
  {
    id: "qwen/qwen3.8-flash",
    label: "Qwen",
    hint: "Qwen 3.8 Flash — strong cheap default",
  },
  {
    id: "deepseek/deepseek-v4.1-flash",
    label: "DeepSeek",
    hint: "DeepSeek V4.1 Flash — agents and code",
  },
  {
    id: "typesafe/jev-router",
    label: "Jev Router",
    hint: "Optional — Jev picks which LLM answers",
  },
];

/** OpenRouter Free Models Router — $0 pool, never the office default. */
export const OPENROUTER_FREE_ROUTER = "openrouter/free";

export const OPENROUTER_FREE_ROUTER_OPTION: OpenRouterFavorite = {
  id: OPENROUTER_FREE_ROUTER,
  label: "Free router",
  hint: "Optional — OpenRouter picks a $0 model that matches tools/vision",
};

export const OPENROUTER_FAVORITE_IDS = OPENROUTER_FAVORITES.map((f) => f.id);

export function isOpenRouterFreeModel(id: string): boolean {
  const m = id.trim();
  return m === OPENROUTER_FREE_ROUTER || m.endsWith(":free");
}

export function favoriteLabel(model: string): string | undefined {
  return OPENROUTER_FAVORITES.find((f) => f.id === model)?.label;
}

export function freeModelLabel(model: string): string | undefined {
  if (model === OPENROUTER_FREE_ROUTER) return OPENROUTER_FREE_ROUTER_OPTION.label;
  if (model.endsWith(":free")) {
    const base = model.slice(0, -5);
    const short = base.split("/").pop() || base;
    return `${short} (free)`;
  }
  return undefined;
}

export function modelPickerLabel(model: string): string {
  return favoriteLabel(model) || freeModelLabel(model) || model;
}
