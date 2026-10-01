"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorLike {
  error?: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: SpeechRecognitionErrorLike) => void) | null;
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

export function speechRecognitionSupported(): boolean {
  return !!getRecognitionCtor();
}

function recognitionErrorMessage(code?: string): string {
  switch (code) {
    case "not-allowed":
      return "Microphone is blocked. Allow mic for this site, then press Space again.";
    case "service-not-allowed":
      return "This browser blocked speech recognition. Try Chrome or Edge.";
    case "audio-capture":
      return "No microphone found.";
    case "network":
      return "Speech service is unreachable. Check the network.";
    case "no-speech":
      return "No speech heard. Press Space and talk right away.";
    case "aborted":
      return "";
    default:
      return code ? `Voice failed (${code}).` : "Voice could not start.";
  }
}

export function isEditableTarget(el: EventTarget | null): el is HTMLElement {
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

export function editableHasText(el: EventTarget | null): boolean {
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    return Boolean(el.value.trim());
  }
  if (el instanceof HTMLElement && (el.isContentEditable || el.closest("[contenteditable='true']"))) {
    return Boolean(el.textContent?.trim());
  }
  return false;
}

function blurEmptyEditable() {
  const el = document.activeElement;
  if (!(el instanceof HTMLElement)) return;
  if (!isEditableTarget(el)) return;
  if (editableHasText(el)) return;
  el.blur();
}

export function useVoice(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef(onFinal);
  const stopSelf = useRef(false);

  useEffect(() => {
    finalRef.current = onFinal;
  }, [onFinal]);

  useEffect(() => {
    const id = setTimeout(() => setSupported(!!getRecognitionCtor()), 0);
    return () => clearTimeout(id);
  }, []);

  const stop = useCallback(() => {
    stopSelf.current = true;
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      setError("Voice needs Chrome, Edge, or Safari — and a microphone.");
      return;
    }
    if (recRef.current) return;
    setError("");
    stopSelf.current = false;
    blurEmptyEditable();
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
    rec.onerror = (e) => {
      const msg = stopSelf.current ? "" : recognitionErrorMessage(e.error);
      if (msg) setError(msg);
      setListening(false);
      setInterim("");
      recRef.current = null;
    };
    recRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      recRef.current = null;
      setListening(false);
      setError("Voice could not start. Click the mic once to allow the microphone, then press Space.");
    }
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

  return { supported, listening, interim, error, start, stop, speak };
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
      const space = e.code === "Space" || e.key === " " || e.key === "Spacebar";
      if (!space) return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (isEditableTarget(e.target) && editableHasText(e.target) && !listeningRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (listeningRef.current) stopRef.current();
      else startRef.current();
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);
}
