import { MCP_CATALOG } from "../mcp-catalog";
import { mcpNavApps, type McpNavApp } from "../mcp-nav";
import { loadConfig, loadCustomConnectors } from "./config";
import { normKey } from "./mcp";

/** Enabled MCP apps from Settings (no network probe). */
export function listEnabledMcpApps(): McpNavApp[] {
  const deny = loadConfig().mcp.deny;
  const custom = loadCustomConnectors().map((c) => ({
    key: normKey(c.name),
    name: c.name,
  }));
  const customKeys = new Set(custom.map((c) => c.key));
  const catalog = MCP_CATALOG.map((item) => ({
    id: item.id,
    name: item.name,
    enabled: customKeys.has(item.id) || customKeys.has(normKey(item.name)),
  }));
  return mcpNavApps({ catalog, custom, deny });
}
