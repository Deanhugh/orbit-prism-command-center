export const SETTINGS_TABS = [
  "General",
  "Appearance",
  "Account",
  "Providers",
  "MCP",
  "Skills",
  "Plugins",
  "Social CRM",
  "Greetings",
  "Sidecar",
] as const;

export type SettingsTab = (typeof SETTINGS_TABS)[number];

export const SETTINGS_SLUG: Record<SettingsTab, string> = {
  General: "general",
  Appearance: "appearance",
  Account: "account",
  Providers: "providers",
  MCP: "mcp",
  Skills: "skills",
  Plugins: "plugins",
  "Social CRM": "social-crm",
  Greetings: "greetings",
  Sidecar: "sidecar",
};

export function settingsHref(tab: SettingsTab) {
  return tab === "General" ? "/jarvis/settings" : `/jarvis/settings?tab=${SETTINGS_SLUG[tab]}`;
}

export function settingsTabFromQuery(raw?: string | null): SettingsTab {
  const key = (raw || "general").toLowerCase().replace(/[\s_]+/g, "-");
  const compact = key.replace(/-/g, "");
  if (key === "connectors") return "MCP";
  return (
    SETTINGS_TABS.find((t) => SETTINGS_SLUG[t] === key) ||
    SETTINGS_TABS.find((t) => t.toLowerCase().replace(/\s+/g, "") === compact) ||
    "General"
  );
}
