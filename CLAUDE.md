@AGENTS.md

# Orbit Prism Operating System — for Claude Code

This is a Next.js app: a 3D isometric office where AI agents do work on your Claude login. When
someone asks you to change the office in this folder, here is where things are and how to change
them safely.

## The office

- **Agents & departments:** `src/lib/office-data.ts`. Six departments, 33 agents. Change an
  agent's `name`, `role`, `does`, or `tools`. Keep `id`, `dept`, and `seat` stable.
- **Config:** `office.config.json` (`studio`, `brain`, `port`, `model`, `mcp`, `tools`). Put
  private overrides in `office.config.local.json` (gitignored).
- **Brain:** the folder pointed to by `brain` in the config. Plain Markdown with `[[wiki links]]`.
  Add notes here to teach the agents how the studio works.
- **Skills:** `skills/<name>/SKILL.md` with front matter `name`, `description`, `agents: [id]`
  and/or `department`. Bound skills are injected into that agent's prompt before a live task.
- **Routines:** created from the UI (a cadence in the task box) or via `POST /api/routines`.

## Runtime (server)

`src/lib/server/`:
- `claude.ts` — detects the CLI and runs `claude -p`. Never give agents Bash or file tools.
- `mcp.ts` — parses `claude mcp list`, applies allow/deny and department wiring.
- `brain.ts` — reads notes, builds the graph, retrieves relevant notes, writes deliverables.
- `skills.ts`, `routines.ts`, `when.ts` — skills and the routines clock / cadence parser.
- `runtime.ts` — the in-memory office: routing, the run loop, demo vs live, the event bus.

## Checks

```bash
npm run lint       # eslint
npx tsc --noEmit   # types
npm run build      # production build
```

Run these after any change. The office defaults to **demo** mode when `claude` is not logged in.
