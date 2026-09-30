import fs from "node:fs";
import path from "node:path";
import { dataDir } from "./config";
import { getSecret, setSecret } from "./providers";

export const FISH_KEY = "FISH_API_KEY";
export const FISH_TTS_URL = "https://api.fish.audio/v1/tts";
export const FISH_MODELS_URL = "https://api.fish.audio/model";

export type FishTtsModel = "s2.1-pro" | "s2.1-pro-free" | "s2-pro";

export interface FishVoice {
  id: string;
  title: string;
  description?: string;
  languages?: string[];
  tags?: string[];
  taskCount?: number;
}

export interface FishVoiceConfig {
  referenceId: string;
  title: string;
  model: FishTtsModel;
}

/** Public Fish Audio library voices. IDs are the model `_id` / `reference_id`. */
export const CURATED_FISH_VOICES: FishVoice[] = [
  {
    id: "41f0953d7a6b4c078445c7e65d620eeb",
    title: "JARVIS",
    description: "Male, conversational — default Jarvis library voice",
    languages: ["en"],
    tags: ["male", "conversational"],
  },
  {
    id: "6bf9194b81814fb59dc8006ef9ad39b3",
    title: "J.A.R.V.I.S",
    description: "Male, formal butler",
    languages: ["en"],
    tags: ["male"],
  },
  {
    id: "30c0f62e3e6d45d88387d1b8f84e1685",
    title: "Liam — Calm British",
    description: "Male, middle-aged narration",
    languages: ["en"],
    tags: ["male", "british", "narration"],
  },
  {
    id: "65c0b8155c464a648161af8877404f11",
    title: "Brian British",
    description: "Male, older narration",
    languages: ["en"],
    tags: ["male", "british", "narration"],
  },
  {
    id: "5e79e8f5d2b345f98baa8c83c947532d",
    title: "Paddington — British narrator",
    description: "Deep, warm male narration",
    languages: ["en"],
    tags: ["male", "british", "narration"],
  },
  {
    id: "fbc1029c018041d4b17f2c1e57222dff",
    title: "Richard — British storyteller",
    description: "Male English storyteller",
    languages: ["en"],
    tags: ["male", "british", "narration"],
  },
  {
    id: "c7882ea59889473cb667d3c7b16cd6f1",
    title: "British Reporter 417",
    description: "Confident news / briefing tone",
    languages: ["en"],
    tags: ["male", "british", "narration"],
  },
];

export const DEFAULT_FISH_VOICE: FishVoiceConfig = {
  referenceId: CURATED_FISH_VOICES[0].id,
  title: CURATED_FISH_VOICES[0].title,
  model: "s2.1-pro-free",
};

function isCreditError(status: number, reason: string) {
  if (status === 402) return true;
  return /insufficient api credit|api credit|no payment|payment required/i.test(reason);
}

const MODELS: FishTtsModel[] = ["s2.1-pro", "s2.1-pro-free", "s2-pro"];

function cfgPath() {
  return path.join(dataDir(), "fish-voice.json");
}

export function fishApiKey(): string | undefined {
  const key = getSecret(FISH_KEY)?.trim();
  return key || undefined;
}

export function hasFishKey(): boolean {
  return Boolean(fishApiKey());
}

export function loadFishVoiceConfig(): FishVoiceConfig {
  try {
    const raw = JSON.parse(fs.readFileSync(cfgPath(), "utf8")) as Partial<FishVoiceConfig>;
    const model = MODELS.includes(raw.model as FishTtsModel) ? (raw.model as FishTtsModel) : DEFAULT_FISH_VOICE.model;
    const referenceId = typeof raw.referenceId === "string" && raw.referenceId.trim()
      ? raw.referenceId.trim()
      : DEFAULT_FISH_VOICE.referenceId;
    const title = typeof raw.title === "string" && raw.title.trim() ? raw.title.trim() : DEFAULT_FISH_VOICE.title;
    return { referenceId, title, model };
  } catch {
    return { ...DEFAULT_FISH_VOICE };
  }
}

export function saveFishVoiceConfig(patch: Partial<FishVoiceConfig>): FishVoiceConfig {
  const current = loadFishVoiceConfig();
  const next: FishVoiceConfig = {
    referenceId: patch.referenceId?.trim() || current.referenceId,
    title: patch.title?.trim() || current.title,
    model: patch.model && MODELS.includes(patch.model) ? patch.model : current.model,
  };
  try {
    fs.mkdirSync(dataDir(), { recursive: true });
    fs.writeFileSync(cfgPath(), JSON.stringify(next, null, 2));
  } catch {
    /* read-only fs */
  }
  return next;
}

export function saveFishApiKey(value: string) {
  setSecret(FISH_KEY, value.trim());
}

function authHeaders(key: string, extra?: Record<string, string>): HeadersInit {
  return {
    Authorization: `Bearer ${key}`,
    ...extra,
  };
}

interface FishModelItem {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  languages?: string[];
  tags?: string[];
  task_count?: number;
  state?: string;
  type?: string;
}

function normalizeVoice(item: FishModelItem): FishVoice | null {
  const id = String(item._id || item.id || "").trim();
  const title = String(item.title || "").trim();
  if (!id || !title) return null;
  if (item.type && item.type !== "tts") return null;
  if (item.state && item.state !== "trained") return null;
  return {
    id,
    title,
    description: item.description || "",
    languages: item.languages || [],
    tags: item.tags || [],
    taskCount: typeof item.task_count === "number" ? item.task_count : undefined,
  };
}

export async function listFishLibrary(opts: { search?: string; page?: number } = {}): Promise<{
  ok: boolean;
  reason: string;
  voices: FishVoice[];
  total: number;
}> {
  const key = fishApiKey();
  if (!key) {
    return { ok: false, reason: "no Fish API key", voices: [], total: 0 };
  }
  const url = new URL(FISH_MODELS_URL);
  url.searchParams.set("page_size", "24");
  url.searchParams.set("page_number", String(Math.max(1, opts.page || 1)));
  url.searchParams.set("sort_by", opts.search ? "score" : "task_count");
  url.searchParams.append("language", "en");
  if (opts.search?.trim()) url.searchParams.set("title", opts.search.trim());
  try {
    const res = await fetch(url, {
      headers: authHeaders(key),
      signal: AbortSignal.timeout(12000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { items?: FishModelItem[]; total?: number; message?: string; error?: string };
    if (!res.ok) {
      return { ok: false, reason: data.message || data.error || `Fish library ${res.status}`, voices: [], total: 0 };
    }
    const voices = (data.items || []).map(normalizeVoice).filter((v): v is FishVoice => Boolean(v));
    return { ok: true, reason: "ok", voices, total: typeof data.total === "number" ? data.total : voices.length };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Fish library unreachable", voices: [], total: 0 };
  }
}

export type FishSpeakResult =
  | { ok: true; audio: Buffer; contentType: string }
  | { ok: false; fallback: true; reason: string };

async function requestFishTts(
  key: string,
  text: string,
  cfg: FishVoiceConfig,
): Promise<FishSpeakResult & { status?: number }> {
  try {
    const res = await fetch(FISH_TTS_URL, {
      method: "POST",
      headers: authHeaders(key, {
        "Content-Type": "application/json",
        model: cfg.model,
      }),
      body: JSON.stringify({
        text,
        reference_id: cfg.referenceId,
        format: "mp3",
        latency: "balanced",
        normalize: true,
      }),
      signal: AbortSignal.timeout(28000),
      cache: "no-store",
    });
    const contentType = res.headers.get("content-type") || "";
    const buf = Buffer.from(await res.arrayBuffer());
    if (!res.ok) {
      let reason = `Fish TTS ${res.status}`;
      if (contentType.includes("json") || contentType.includes("text")) {
        try {
          const err = JSON.parse(buf.toString("utf8")) as { message?: string; error?: string };
          reason = err.message || err.error || reason;
        } catch {
          if (buf.length < 400) reason = buf.toString("utf8") || reason;
        }
      }
      return { ok: false, fallback: true, reason, status: res.status };
    }
    if (contentType.includes("json")) {
      try {
        const err = JSON.parse(buf.toString("utf8")) as { message?: string; error?: string };
        return {
          ok: false,
          fallback: true,
          reason: err.message || err.error || "Fish returned JSON instead of audio",
          status: res.status,
        };
      } catch {
        return { ok: false, fallback: true, reason: "Fish returned JSON instead of audio", status: res.status };
      }
    }
    if (buf.length < 64) {
      return { ok: false, fallback: true, reason: "Fish returned empty audio", status: res.status };
    }
    return { ok: true, audio: buf, contentType: contentType.includes("audio") ? contentType : "audio/mpeg" };
  } catch (err) {
    return { ok: false, fallback: true, reason: err instanceof Error ? err.message : "Fish TTS unreachable" };
  }
}

export async function synthesizeFish(text: string): Promise<FishSpeakResult> {
  const key = fishApiKey();
  if (!key) return { ok: false, fallback: true, reason: "no Fish API key" };
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 2500);
  if (!clean) return { ok: false, fallback: true, reason: "empty text" };
  const cfg = loadFishVoiceConfig();
  const first = await requestFishTts(key, clean, cfg);
  if (first.ok) return first;
  if (cfg.model !== "s2.1-pro-free" && isCreditError(first.status || 0, first.reason)) {
    const freeCfg = saveFishVoiceConfig({ model: "s2.1-pro-free" });
    const retry = await requestFishTts(key, clean, freeCfg);
    if (retry.ok) return retry;
    return {
      ok: false,
      fallback: true,
      reason: `${retry.reason} Paid ${cfg.model} needs API credit at https://fish.audio/app/developers. s2.1-pro-free also failed.`,
    };
  }
  return first;
}

export async function fishStatus(search?: string) {
  const key = hasFishKey();
  const voice = loadFishVoiceConfig();
  const library = key
    ? await listFishLibrary({ search })
    : { ok: false, reason: "no Fish API key", voices: [] as FishVoice[], total: 0 };
  return {
    hasKey: key,
    configured: key,
    voice,
    curated: CURATED_FISH_VOICES,
    library: library.voices,
    libraryTotal: library.total,
    libraryOk: library.ok,
    reason: key
      ? `Fish Audio · ${voice.title} · ${voice.model}`
      : "Paste a Fish API key to use a library voice. Browser speech stays as fallback.",
  };
}
