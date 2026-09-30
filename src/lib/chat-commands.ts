export const SLASH_COMMANDS = [
  { cmd: "/clear", hint: "Clear this chat history" },
  { cmd: "/task", hint: "Run the rest as a desk task" },
  { cmd: "/plan", hint: "Plan before answering" },
  { cmd: "/chat", hint: "Normal chat" },
  { cmd: "/help", hint: "List pill commands" },
] as const;

export type SlashCmd = (typeof SLASH_COMMANDS)[number]["cmd"];

/** "/task draft a poster" → { command: "/task", rest: "draft a poster" } */
export function parseSlash(text: string): { command: SlashCmd; rest: string } | null {
  const t = text.trim();
  const m = t.match(/^(\/clear|\/task|\/plan|\/chat|\/help)(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  const command = m[1].toLowerCase() as SlashCmd;
  return { command, rest: (m[2] || "").trim() };
}

export function slashSuggestions(text: string) {
  const t = text.trim().toLowerCase();
  if (!t.startsWith("/")) return [];
  const token = t.split(/\s+/)[0];
  return SLASH_COMMANDS.filter((c) => c.cmd.startsWith(token));
}

/** Text after the last @ that is still a mention (no space after). */
export function mentionQuery(text: string): string | null {
  const at = text.lastIndexOf("@");
  if (at < 0) return null;
  if (at > 0 && /[\w]/.test(text[at - 1] || "")) return null;
  const after = text.slice(at + 1);
  if (/\s/.test(after)) return null;
  return after;
}

export const PILL_PLACEHOLDER = "Message or run a task, / commands, @ files";

/** Demo provider/model stays in Settings; hide it from the Agents Office pill. */
export function isDemoChoice(provider?: string, model?: string) {
  return /^demo$/i.test(provider ?? "") || /^demo$/i.test(model ?? "");
}
