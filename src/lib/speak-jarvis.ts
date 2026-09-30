/** Jarvis speech: Fish Audio library voice when a key is saved, else browser TTS. */

type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
};

let primed = false;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let active: SpeechSynthesisUtterance | null = null;
let audioEl: HTMLAudioElement | null = null;
let objectUrl: string | null = null;
let gen = 0;

function synth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis || null;
}

function stopKeepAlive() {
  if (keepAlive) {
    clearInterval(keepAlive);
    keepAlive = null;
  }
}

function stopAudio() {
  if (audioEl) {
    try {
      audioEl.onplay = null;
      audioEl.onended = null;
      audioEl.onerror = null;
      audioEl.pause();
      audioEl.removeAttribute("src");
      audioEl.load();
    } catch {
      /* ignore */
    }
    audioEl = null;
  }
  if (objectUrl) {
    try {
      URL.revokeObjectURL(objectUrl);
    } catch {
      /* ignore */
    }
    objectUrl = null;
  }
}

function pickVoice(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = s.getVoices();
  if (!voices.length) return null;
  return (
    voices.find((v) => /en[-_]US/i.test(v.lang) && v.localService) ||
    voices.find((v) => /^en/i.test(v.lang) && v.localService) ||
    voices.find((v) => /en[-_]US/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang)) ||
    voices[0] ||
    null
  );
}

function cleanText(text: string, max = 1400): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

/** Call from a click / tap so the browser allows speech after the brief fetch. */
export function primeJarvisSpeech() {
  const s = synth();
  primed = true;
  if (!s) return;
  try {
    s.resume();
  } catch {
    /* ignore */
  }
  if (s.speaking || s.pending) return;
  const unlock = new SpeechSynthesisUtterance(" ");
  unlock.volume = 0.01;
  unlock.rate = 2;
  unlock.lang = "en-US";
  try {
    s.speak(unlock);
  } catch {
    /* ignore */
  }
}

export function stopJarvisSpeech() {
  gen += 1;
  stopKeepAlive();
  stopAudio();
  active = null;
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

function speakBrowser(text: string, handlers: SpeakHandlers, token: number) {
  const s = synth();
  const clean = cleanText(text, 1400);
  if (!s || !clean) {
    if (token === gen) handlers.onEnd?.();
    return;
  }

  const start = () => {
    if (token !== gen) return;
    stopKeepAlive();
    try {
      s.cancel();
      s.resume();
    } catch {
      /* ignore */
    }
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "en-US";
    u.rate = 1.04;
    u.pitch = 0.95;
    u.volume = 1;
    const voice = pickVoice(s);
    if (voice) u.voice = voice;
    u.onstart = () => {
      if (token === gen) handlers.onStart?.();
    };
    u.onend = () => {
      if (active === u) active = null;
      stopKeepAlive();
      if (token === gen) handlers.onEnd?.();
    };
    u.onerror = () => {
      if (active === u) active = null;
      stopKeepAlive();
      if (token === gen) handlers.onEnd?.();
    };
    active = u;
    window.setTimeout(() => {
      if (token !== gen || active !== u) return;
      try {
        s.speak(u);
        s.resume();
      } catch {
        if (token === gen) handlers.onEnd?.();
        return;
      }
      keepAlive = setInterval(() => {
        if (!s.speaking) {
          stopKeepAlive();
          return;
        }
        try {
          s.pause();
          s.resume();
        } catch {
          /* ignore */
        }
      }, 8000);
    }, 60);
  };

  if (s.getVoices().length === 0) {
    const once = () => {
      s.removeEventListener("voiceschanged", once);
      start();
    };
    s.addEventListener("voiceschanged", once);
    s.getVoices();
    window.setTimeout(() => {
      s.removeEventListener("voiceschanged", once);
      start();
    }, 300);
    return;
  }
  start();
}

export type JarvisSpeakResult = { source: "fish" | "browser"; reason?: string };

async function readSpeakFailure(res: Response): Promise<string> {
  try {
    const data = (await res.clone().json()) as { reason?: string };
    if (data.reason) return data.reason;
  } catch {
    /* not json */
  }
  return `Fish TTS ${res.status}`;
}

async function speakFish(
  text: string,
  handlers: SpeakHandlers,
  token: number,
): Promise<JarvisSpeakResult & { used: boolean }> {
  const res = await fetch("/api/jarvis/voice/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (token !== gen) return { used: true, source: "fish" };
  const type = res.headers.get("content-type") || "";
  if (!res.ok || type.includes("json")) {
    return { used: false, source: "browser", reason: await readSpeakFailure(res) };
  }
  const blob = await res.blob();
  if (token !== gen) return { used: true, source: "fish" };
  if (!blob.size || blob.type.includes("json")) {
    return { used: false, source: "browser", reason: "Fish returned no audio" };
  }
  stopAudio();
  const url = URL.createObjectURL(blob);
  objectUrl = url;
  const a = new Audio(url);
  audioEl = a;
  a.onplay = () => {
    if (token === gen) handlers.onStart?.();
  };
  a.onended = () => {
    if (audioEl === a) stopAudio();
    if (token === gen) handlers.onEnd?.();
  };
  a.onerror = () => {
    if (audioEl === a) stopAudio();
    if (token === gen) speakBrowser(text, handlers, token);
  };
  try {
    await a.play();
    return { used: true, source: "fish" };
  } catch {
    stopAudio();
    return { used: false, source: "browser", reason: "Browser blocked Fish audio playback" };
  }
}

export function speakJarvis(text: string, handlers: SpeakHandlers = {}): Promise<JarvisSpeakResult> {
  const clean = cleanText(text, 2500);
  if (!clean) {
    handlers.onEnd?.();
    return Promise.resolve({ source: "browser", reason: "empty text" });
  }
  primed = true;
  const token = ++gen;
  stopKeepAlive();
  stopAudio();
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }

  return (async () => {
    let reason: string | undefined;
    try {
      const fish = await speakFish(clean, handlers, token);
      if (fish.used || token !== gen) return { source: fish.source, reason: fish.reason };
      reason = fish.reason;
    } catch {
      reason = "Fish TTS unreachable";
    }
    if (token !== gen) return { source: "browser", reason };
    speakBrowser(clean, handlers, token);
    return { source: "browser", reason: reason || "Fish TTS unavailable" };
  })();
}

export function spokenBrief(brief: {
  greeting?: string;
  narrative?: string;
  sections?: { today?: string[]; waitingOnYou?: string[] };
}): string {
  return [
    brief.greeting,
    brief.narrative,
    ...(brief.sections?.today || []).slice(0, 4),
    ...(brief.sections?.waitingOnYou || []).slice(0, 4),
  ]
    .filter(Boolean)
    .join(". ");
}

export function jarvisSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(window.speechSynthesis) || typeof Audio !== "undefined";
}

export function jarvisSpeechPrimed(): boolean {
  return primed;
}
