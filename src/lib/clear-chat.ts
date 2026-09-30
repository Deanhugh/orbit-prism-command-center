/** True when the owner is asking to wipe this agent conversation, not do other work. */
export function looksLikeClearChat(text: string): boolean {
  const t = text
    .trim()
    .toLowerCase()
    .replace(/[?!.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return false;
  return /^(please )?(can you |could you |would you )?(just )?(clear|wipe|erase|empty|delete|reset)\s+(out )?(the |this |my |our )?(chat( history)?|conversation|thread|history)\b/.test(
    t,
  );
}
