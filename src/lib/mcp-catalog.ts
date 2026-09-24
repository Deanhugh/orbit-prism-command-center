/** Curated MCP apps users can browse, search, and enable from Settings or the chat + menu. */
export interface McpCatalogItem {
  id: string;
  name: string;
  description: string;
  command: string;
  transport: "stdio" | "http" | "sse";
}

export const MCP_CATALOG: McpCatalogItem[] = [
  { id: "googledrive", name: "Google Drive", description: "Search, read, and create files", command: "npx -y @modelcontextprotocol/server-gdrive", transport: "stdio" },
  { id: "googlecalendar", name: "Google Calendar", description: "Search events and schedules", command: "npx -y @cocal/google-calendar-mcp", transport: "stdio" },
  { id: "gmail", name: "Gmail", description: "Search, read, and draft email", command: "npx -y @gongrzhe/server-gmail-autoauth-mcp", transport: "stdio" },
  { id: "slack", name: "Slack", description: "Read and send workspace messages", command: "npx -y @modelcontextprotocol/server-slack", transport: "stdio" },
  { id: "notion", name: "Notion", description: "Search and update workspace pages", command: "npx -y @notionhq/notion-mcp-server", transport: "stdio" },
  { id: "github", name: "GitHub", description: "Repos, issues, and pull requests", command: "npx -y @modelcontextprotocol/server-github", transport: "stdio" },
  { id: "linear", name: "Linear", description: "Issues and project tracking", command: "npx -y @llmindset/mcp-linear", transport: "stdio" },
  { id: "jira", name: "Jira", description: "Work items and sprints", command: "npx -y @aashari/mcp-server-atlassian-jira", transport: "stdio" },
  { id: "hubspot", name: "HubSpot", description: "CRM contacts and deals", command: "npx -y @modelcontextprotocol/server-hubspot", transport: "stdio" },
  { id: "stripe", name: "Stripe", description: "Payments and customers", command: "npx -y @stripe/mcp", transport: "stdio" },
  { id: "airtable", name: "Airtable", description: "Bases, records, and views", command: "npx -y @domdomegg/airtable-mcp-server", transport: "stdio" },
  { id: "asana", name: "Asana", description: "Tasks and project work", command: "npx -y @roychri/mcp-server-asana", transport: "stdio" },
  { id: "trello", name: "Trello", description: "Boards, lists, and cards", command: "npx -y @delorenj/mcp-server-trello", transport: "stdio" },
  { id: "discord", name: "Discord", description: "Channels and messages", command: "npx -y @modelcontextprotocol/server-discord", transport: "stdio" },
  { id: "zoom", name: "Zoom", description: "Meetings and recordings", command: "npx -y @ejaay/mcp-zoom", transport: "stdio" },
  { id: "postgres", name: "Postgres", description: "Query a Postgres database", command: "npx -y @modelcontextprotocol/server-postgres", transport: "stdio" },
  { id: "filesystem", name: "Filesystem", description: "Read and write local files", command: "npx -y @modelcontextprotocol/server-filesystem", transport: "stdio" },
  { id: "brave", name: "Web Search", description: "Search the public web", command: "npx -y @modelcontextprotocol/server-brave-search", transport: "stdio" },
  { id: "puppeteer", name: "Browser", description: "Browse pages with a headless browser", command: "npx -y @modelcontextprotocol/server-puppeteer", transport: "stdio" },
];

export function catalogItem(id: string): McpCatalogItem | undefined {
  return MCP_CATALOG.find((i) => i.id === id);
}

export function parseMcpCommand(command: string): { target: string; args: string[] } {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  return { target: parts[0] || command, args: parts.slice(1) };
}
