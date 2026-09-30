"use client";

import { useCallback, useEffect, useState } from "react";
import { emptyHub, type JarvisHub } from "@/lib/jarvis-data";
import { HUB_CHANGED, notifyHubChanged } from "@/lib/jarvis-events";

export function useJarvisHub(initial?: JarvisHub | null, username = "there") {
  const [hub, setHub] = useState<JarvisHub | null>(initial ?? emptyHub(username));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(!initial);

  const reload = useCallback(() => {
    const ac = new AbortController();
    const timer = window.setTimeout(() => ac.abort(), 4000);
    fetch("/api/jarvis/hub", { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw new Error("Could not load Jarvis");
        return r.json();
      })
      .then((d) => {
        setHub(d);
        setError("");
      })
      .catch((e) => {
        if ((e as Error).name === "AbortError") {
          setError("");
          return;
        }
        setError(String((e as Error).message || e));
      })
      .finally(() => {
        window.clearTimeout(timer);
        setLoading(false);
      });
    return () => {
      window.clearTimeout(timer);
      ac.abort();
    };
  }, []);

  useEffect(() => {
    if (initial) {
      setLoading(false);
      return;
    }
    return reload();
  }, [reload, initial]);

  useEffect(() => {
    function onChange(ev: Event) {
      const next = (ev as CustomEvent<JarvisHub | null>).detail;
      if (next && next.profile) {
        setHub(next);
        setError("");
        setLoading(false);
        return;
      }
      reload();
    }
    window.addEventListener(HUB_CHANGED, onChange);
    return () => window.removeEventListener(HUB_CHANGED, onChange);
  }, [reload]);

  const save = useCallback(async (patch: Partial<JarvisHub>) => {
    setHub((prev) => (prev ? { ...prev, ...patch } : prev));
    const res = await fetch("/api/jarvis/hub", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError("Could not save that change.");
      throw new Error("Could not save");
    }
    const next = (await res.json()) as JarvisHub;
    setHub(next);
    setError("");
    notifyHubChanged(next);
    return next;
  }, []);

  return { hub, error, loading, reload, save };
}
