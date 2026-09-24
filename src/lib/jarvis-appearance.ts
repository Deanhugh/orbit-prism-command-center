export type ChromeMode = "battle" | "minimal";
export type PaletteId = "orbit" | "basic" | "brand" | "midnight" | "forest" | "sunset" | "light";

export const COLOR_FIELDS = [
  { key: "background", label: "Background" },
  { key: "backgroundSecondary", label: "Background secondary" },
  { key: "card", label: "Card" },
  { key: "cardHover", label: "Card hover" },
  { key: "border", label: "Border" },
  { key: "borderHover", label: "Border hover" },
  { key: "text", label: "Text" },
  { key: "textSecondary", label: "Text secondary" },
  { key: "textTertiary", label: "Text tertiary" },
  { key: "accentRed", label: "Rose" },
  { key: "accentGreen", label: "Cyan" },
  { key: "accentBlue", label: "Cyan signal" },
  { key: "accentYellow", label: "Gold" },
  { key: "accentPurple", label: "Muted" },
  { key: "accentOrange", label: "Gold signal" },
] as const;

export type ColorKey = (typeof COLOR_FIELDS)[number]["key"];
export type ColorMap = Record<ColorKey, string>;

export interface JarvisAppearance {
  chrome: ChromeMode;
  palette: PaletteId;
  colors: Partial<ColorMap>;
}

const ORBIT_COLORS: ColorMap = {
  background: "#0A0514",
  backgroundSecondary: "#1C1F26",
  card: "#1C1F26",
  cardHover: "#2C2331",
  border: "#2C2331",
  borderHover: "#68BCD3",
  text: "#FFFFFF",
  textSecondary: "#9AA8B0",
  textTertiary: "#588894",
  accentRed: "#E06368",
  accentGreen: "#68BCD3",
  accentBlue: "#68BCD3",
  accentYellow: "#FFC300",
  accentPurple: "#588894",
  accentOrange: "#FFC300",
};

export const PALETTES: Record<
  PaletteId,
  { name: string; blurb: string; swatches: [string, string]; colors: ColorMap; dark: boolean }
> = {
  orbit: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  basic: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  brand: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  midnight: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  forest: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  sunset: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
  light: {
    name: "Orbit Prism",
    blurb: "Brand kit — one operating style",
    swatches: ["#0A0514", "#68BCD3"],
    dark: true,
    colors: ORBIT_COLORS,
  },
};

export function defaultAppearance(): JarvisAppearance {
  return { chrome: "battle", palette: "orbit", colors: {} };
}

export function resolveColors(appearance: JarvisAppearance): ColorMap {
  const next = { ...ORBIT_COLORS };
  for (const field of COLOR_FIELDS) {
    const raw = (appearance.colors?.[field.key] || "").trim();
    if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(raw)) next[field.key] = raw;
  }
  return next;
}

export function applyAppearance(appearance: JarvisAppearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const colors = resolveColors(appearance);
  root.classList.remove("dark");
  root.classList.toggle("jarvis-minimal", appearance.chrome === "minimal");
  root.style.setProperty("--color-canvas", colors.background);
  root.style.setProperty("--color-canvas-2", colors.backgroundSecondary);
  root.style.setProperty("--color-panel", colors.card);
  root.style.setProperty("--color-line", colors.border);
  root.style.setProperty("--color-ink", colors.text);
  root.style.setProperty("--color-ink-soft", colors.textSecondary);
  root.style.setProperty("--color-marketing", colors.accentRed);
  root.style.setProperty("--color-emails", colors.accentGreen);
  root.style.setProperty("--color-ops", colors.accentPurple);
  root.style.setProperty("--color-finance", colors.accentOrange);
  root.style.setProperty("--color-card-hover", colors.cardHover);
  root.style.setProperty("--color-line-hover", colors.borderHover);
  root.style.setProperty("--color-ink-faint", colors.textTertiary);
  root.style.setProperty("--color-accent-blue", colors.accentBlue);
  root.style.setProperty("--color-accent-yellow", colors.accentYellow);
  root.style.setProperty("--color-cyan", colors.accentBlue);
}
