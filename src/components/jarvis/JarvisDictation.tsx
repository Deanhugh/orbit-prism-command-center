"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSpaceToTalk, useVoice } from "@/lib/use-voice";
import { notifyHubChanged } from "@/lib/jarvis-events";
import { primeJarvisSpeech, speakJarvis } from "@/lib/speak-jarvis";
import type { JarvisHub } from "@/lib/jarvis-data";

export const TODAY_CHAT_EVENT = "orbit-today-chat";

export function notifyTodayChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TODAY_CHAT_EVENT));
}

interface DictationCtx {
  supported: boolean;
  listening: boolean;
  interim: string;
  error: string;
  start: () => void;
  stop: () => void;
  registerTarget: (fn: ((text: string) => void) | null) => void;
}

const JarvisDictationContext = createContext<DictationCtx | null>(null);

export function useJarvisDictation(): DictationCtx {
  const ctx = useContext(JarvisDictationContext);
  if (!ctx) {
    throw new Error("useJarvisDictation must be used inside JarvisDictationProvider");
  }
  return ctx;
}

export function JarvisDictationProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const targetRef = useRef<((text: string) => void) | null>(null);

  const ingest = useCallback(
    async (text: string) => {
      if (targetRef.current) {
        targetRef.current(text);
        return;
      }
      primeJarvisSpeech();
      try {
        const res = await fetch("/api/jarvis/today-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = (await res.json()) as {
          messages?: { role: string; content: string }[];
          hub?: JarvisHub;
          open?: string;
        };
        if (data.hub) notifyHubChanged(data.hub);
        notifyTodayChat();
        if (data.open === "/draw") router.push("/draw");
        const last = (data.messages || []).filter((l) => l.role === "assistant").at(-1);
        if (last?.content) speakJarvis(last.content);
      } catch {
        /* pill shows recognition errors; network failures stay silent here */
      }
    },
    [router],
  );

  const onVoice = useCallback(
    (spoken: string) => {
      void ingest(spoken);
    },
    [ingest],
  );

  const { supported, listening, interim, error, start, stop } = useVoice(onVoice);
  useSpaceToTalk({ enabled: true, listening, start, stop });

  const registerTarget = useCallback((fn: ((spoken: string) => void) | null) => {
    targetRef.current = fn;
  }, []);

  const value = useMemo(
    () => ({ supported, listening, interim, error, start, stop, registerTarget }),
    [supported, listening, interim, error, start, stop, registerTarget],
  );

  return (
    <JarvisDictationContext.Provider value={value}>
      {children}
      {listening || error ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-[80] max-w-[min(92vw,420px)] -translate-x-1/2 rounded-full border border-line bg-panel px-4 py-2 text-center text-[12px] text-ink shadow-lg"
        >
          {listening ? (
            <span className="text-cyan">{interim.trim() ? interim : "Listening… talk to Jarvis"}</span>
          ) : (
            <span className="text-marketing">{error}</span>
          )}
        </div>
      ) : null}
    </JarvisDictationContext.Provider>
  );
}

export function useRegisterJarvisDictation(handler: (text: string) => void) {
  const { registerTarget } = useJarvisDictation();
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);
  useEffect(() => {
    registerTarget((text) => handlerRef.current(text));
    return () => registerTarget(null);
  }, [registerTarget]);
}
