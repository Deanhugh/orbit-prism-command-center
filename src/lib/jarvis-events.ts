import type { JarvisHub } from "./jarvis-data";

export const HUB_CHANGED = "jarvis-hub-changed";

export function notifyHubChanged(hub?: JarvisHub | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(HUB_CHANGED, { detail: hub ?? null }));
}
