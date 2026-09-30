"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}
type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoice(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);

  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const id = setTimeout(() => setSupported(!!getRecognitionCtor()), 0);
    return () => clearTimeout(id);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recRef.current) return;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let text = "";
      let isFinal = false;
      for (let i = 0; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        if (e.results[i].isFinal) isFinal = true;
      }
      setInterim(text);
      if (isFinal && text.trim()) {
        finalRef.current(text.trim());
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const speak = useCallback((text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = text.replace(/[#*_`>\-]/g, " ").slice(0, 500);
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.05;
    u.pitch = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }, []);

  return { supported, listening, interim, start, stop, speak };
}

function isEditableTarget(el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "SELECT") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["button", "submit", "reset", "checkbox", "radio", "file", "range", "color", "hidden"].includes(type);
  }
  return el.isContentEditable || Boolean(el.closest("[contenteditable='true']"));
}

function editableHasText(el: EventTarget | null): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return Boolean(el.value.trim());
  }
  if (el instanceof HTMLElement && el.isContentEditable) {
    return Boolean(el.textContent?.trim());
  }
  return false;
}

/** Space starts or stops the mic, unless the user is typing a space in a filled field. */
export function useSpaceToTalk(opts: {
  enabled: boolean;
  listening: boolean;
  start: () => void;
  stop: () => void;
}) {
  const startRef = useRef(opts.start);
  const stopRef = useRef(opts.stop);
  const listeningRef = useRef(opts.listening);
  const enabledRef = useRef(opts.enabled);

  useEffect(() => {
    startRef.current = opts.start;
    stopRef.current = opts.stop;
    listeningRef.current = opts.listening;
    enabledRef.current = opts.enabled;
  }, [opts.start, opts.stop, opts.listening, opts.enabled]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!enabledRef.current) return;
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target) && editableHasText(e.target) && !listeningRef.current) return;
      e.preventDefault();
      if (listeningRef.current) stopRef.current();
      else startRef.current();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
