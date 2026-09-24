// Brand logos for the connector strip. Real logos where an open icon exists
// (simple-icons, CC0 path data); tasteful colored initials otherwise. No user
// uploads needed — unknown MCP servers fall back to initials automatically.
import {
  siGmail,
  siGoogledrive,
  siGooglecalendar,
  siGooglemeet,
  siNotion,
  siMeta,
  siStripe,
  siXero,
  siClaude,
  siHubspot,
  siLinear,
  siJira,
  siTrello,
  siAirtable,
  siGithub,
  siGooglegemini,
  siShopify,
  siZapier,
  siDiscord,
  siZoom,
  siAsana,
  siPostgresql,
  siWordpress,
} from "simple-icons";

interface Brand {
  path: string;
  hex: string;
}

const ICON: Record<string, Brand> = {
  gmail: siGmail,
  googledrive: siGoogledrive,
  googlecalendar: siGooglecalendar,
  googlemeet: siGooglemeet,
  notion: siNotion,
  meta: siMeta,
  stripe: siStripe,
  xero: siXero,
  claude: siClaude,
  hubspot: siHubspot,
  linear: siLinear,
  jira: siJira,
  trello: siTrello,
  airtable: siAirtable,
  github: siGithub,
  gemini: siGooglegemini,
  shopify: siShopify,
  zapier: siZapier,
  discord: siDiscord,
  zoom: siZoom,
  asana: siAsana,
  postgres: siPostgresql,
  postgresql: siPostgresql,
  wordpress: siWordpress,
};

// Colored fallbacks for brands without an open logo (shown as initials on a tile).
const COLOR: Record<string, string> = {
  slack: "#611f69",
  canva: "#00c4cc",
  beehiiv: "#f7c948",
  apollo: "#0c7bdc",
  clearbit: "#4e6ef2",
  loops: "#ec5a4e",
  pandadoc: "#17c4a3",
  websearch: "#5b6472",
  imessage: "#34da50",
  hyperframes: "#8a6bd0",
  crm: "#1f6feb",
  bigcapital: "#0f766e",
  plane: "#3f76ff",
  trypost: "#e8562e",
  mautic: "#4e5e9e",
};

export function connectorIcon(key: string): Brand | null {
  return ICON[key] ?? null;
}

export function connectorColor(key: string): string | null {
  return COLOR[key] ?? null;
}
