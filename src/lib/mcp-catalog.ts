/** Curated MCP apps users can browse, search, and enable from Settings or the chat + menu. */
export interface McpCatalogItem {
  id: string;
  name: string;
  description: string;
  command: string;
  transport: "stdio" | "http" | "sse";
  /** Remote HTTP/SSE servers can go live on Railway. stdio needs Claude Code. */
  remote?: boolean;
  auth?: "none" | "bearer" | "oauth";
  hint?: string;
}

export const MCP_CATALOG: McpCatalogItem[] = [
  {
    id: "notion",
    name: "Notion",
    description: "Search and update workspace pages — live remote MCP on Railway",
    command: "https://mcp.notion.com/mcp",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with Notion (OAuth) or paste an internal integration token (ntn_ / secret_). Share pages with the integration.",
  },
  {
    id: "krea",
    name: "Krea",
    description: "Generate images and video with Krea — live remote MCP on Railway",
    command: "https://api.krea.ai/mcp",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with Krea (OAuth) or paste KREA_API_TOKEN from krea.ai/app/api/tokens. Use https://api.krea.ai/mcp (the page at www.krea.ai/mcp is the setup guide). Runs use your Krea workspace.",
  },
  {
    id: "higgsfield",
    name: "Higgsfield",
    description: "Generate images, video, characters, and audio with Higgsfield — live remote MCP on Railway",
    command: "https://mcp.higgsfield.ai/mcp",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with Higgsfield (OAuth only — no API key). Uses your higgsfield.ai credits. URL: https://mcp.higgsfield.ai/mcp.",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read and send Orbit Prism workspace messages — live remote MCP on Railway",
    command: "https://mcp.slack.com/mcp",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Workspace orbit-prism.slack.com. Connect with OAuth (needs a Slack app Client ID + Secret — Slack has no dynamic registration) or paste an xoxp- user token. URL: https://mcp.slack.com/mcp.",
  },
  {
    id: "apify",
    name: "Apify",
    description: "Scrape websites and social media via Apify Store Actors — live remote MCP on Railway",
    command:
      "https://mcp.apify.com?tools=actors,apify/rag-web-browser,apify/web-fetch,apify/instagram-scraper,apify/google-search-scraper",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with Apify (OAuth) or paste APIFY_TOKEN from console.apify.com → Settings → Integrations. Runs use your Apify credits.",
  },
  {
    id: "github",
    name: "GitHub",
    description: "Repos, issues, and pull requests — live remote MCP",
    command: "https://api.githubcopilot.com/mcp/",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with GitHub (OAuth) or paste a PAT that can access the Copilot MCP.",
  },
  {
    id: "stripe",
    name: "Stripe",
    description: "Payments and customers — live remote MCP",
    command: "https://mcp.stripe.com",
    transport: "http",
    remote: true,
    auth: "oauth",
    hint: "Connect with Stripe (OAuth) or paste a restricted API key if the server accepts Bearer auth.",
  },
  { id: "googledrive", name: "Google Drive", description: "Search, read, and create files (local CLI)", command: "npx -y @modelcontextprotocol/server-gdrive", transport: "stdio" },
  { id: "googlecalendar", name: "Google Calendar", description: "Search events and schedules (local CLI)", command: "npx -y @cocal/google-calendar-mcp", transport: "stdio" },
  { id: "gmail", name: "Gmail", description: "Search, read, and draft email (local CLI)", command: "npx -y @gongrzhe/server-gmail-autoauth-mcp", transport: "stdio" },
  { id: "linear", name: "Linear", description: "Issues and project tracking (local CLI)", command: "npx -y @llmindset/mcp-linear", transport: "stdio" },
  { id: "jira", name: "Jira", description: "Work items and sprints (local CLI)", command: "npx -y @aashari/mcp-server-atlassian-jira", transport: "stdio" },
  { id: "hubspot", name: "HubSpot", description: "CRM contacts and deals (local CLI)", command: "npx -y @modelcontextprotocol/server-hubspot", transport: "stdio" },
  { id: "airtable", name: "Airtable", description: "Bases, records, and views (local CLI)", command: "npx -y @domdomegg/airtable-mcp-server", transport: "stdio" },
  { id: "asana", name: "Asana", description: "Tasks and project work (local CLI)", command: "npx -y @roychri/mcp-server-asana", transport: "stdio" },
  { id: "trello", name: "Trello", description: "Boards, lists, and cards (local CLI)", command: "npx -y @delorenj/mcp-server-trello", transport: "stdio" },
  { id: "discord", name: "Discord", description: "Channels and messages (local CLI)", command: "npx -y @modelcontextprotocol/server-discord", transport: "stdio" },
  { id: "zoom", name: "Zoom", description: "Meetings and recordings (local CLI)", command: "npx -y @ejaay/mcp-zoom", transport: "stdio" },
  { id: "postgres", name: "Postgres", description: "Query a Postgres database (local CLI)", command: "npx -y @modelcontextprotocol/server-postgres", transport: "stdio" },
  { id: "filesystem", name: "Filesystem", description: "Read and write local files (local CLI)", command: "npx -y @modelcontextprotocol/server-filesystem", transport: "stdio" },
  { id: "brave", name: "Web Search", description: "Search the public web (local CLI)", command: "npx -y @modelcontextprotocol/server-brave-search", transport: "stdio" },
  { id: "puppeteer", name: "Browser", description: "Browse pages with a headless browser (local CLI)", command: "npx -y @modelcontextprotocol/server-puppeteer", transport: "stdio" },
];

export function catalogItem(id: string): McpCatalogItem | undefined {
  return MCP_CATALOG.find((i) => i.id === id);
}

export function catalogItemByName(name: string): McpCatalogItem | undefined {
  const n = name.toLowerCase().replace(/[^a-z0-9]/g, "");
  return MCP_CATALOG.find((i) => i.id === n || i.name.toLowerCase().replace(/[^a-z0-9]/g, "") === n);
}

export function parseMcpCommand(command: string): { target: string; args: string[] } {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  return { target: parts[0] || command, args: parts.slice(1) };
}
