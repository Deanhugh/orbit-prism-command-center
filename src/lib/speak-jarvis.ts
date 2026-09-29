/** Browser TTS for Jarvis. Chrome drops utterances after async work and after ~15s unless we keep the synth alive. */

type SpeakHandlers = {
  onStart?: () => void;
  onEnd?: () => void;
};

let primed = false;
let keepAlive: ReturnType<typeof setInterval> | null = null;
let active: SpeechSynthesisUtterance | null = null;

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

function cleanText(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#*_`>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1400);
}

/** Call from a click / tap so the browser allows speech after the brief fetch. */
export function primeJarvisSpeech() {
  const s = synth();
  if (!s) return;
  primed = true;
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
  stopKeepAlive();
  active = null;
  try {
    synth()?.cancel();
  } catch {
    /* ignore */
  }
}

export function speakJarvis(text: string, handlers: SpeakHandlers = {}) {
  const s = synth();
  const clean = cleanText(text);
  if (!s || !clean) {
    handlers.onEnd?.();
    return;
  }
  primed = true;

  const start = () => {
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
    u.onstart = () => handlers.onStart?.();
    u.onend = () => {
      if (active === u) active = null;
      stopKeepAlive();
      handlers.onEnd?.();
    };
    u.onerror = () => {
      if (active === u) active = null;
      stopKeepAlive();
      handlers.onEnd?.();
    };
    active = u;
    // Chrome drops speak() if it follows cancel() in the same tick.
    window.setTimeout(() => {
      if (active !== u) return;
      try {
        s.speak(u);
        s.resume();
      } catch {
        handlers.onEnd?.();
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
  return Boolean(synth());
}

export function jarvisSpeechPrimed(): boolean {
  return primed;
}
