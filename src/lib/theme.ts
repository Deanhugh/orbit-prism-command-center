export const THEME_COOKIE = "orbit_theme";

export type ThemeMode = "dark";

export function parseTheme(_raw?: string | null): ThemeMode {
  return "dark";
}

export function writeThemeCookie(_theme?: ThemeMode) {
  if (typeof document === "undefined") return;
  try {
    localStorage.removeItem("orbit-theme");
  } catch {
    /* ignore */
  }
}

export function themeFromDocument(): ThemeMode {
  return "dark";
}
