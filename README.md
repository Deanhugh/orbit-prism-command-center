# Orbit Prism Command Center

Jarvis / Command Center for Orbit Prism. Live:

https://command-center-production-e72e.up.railway.app/

Repo: [Deanhugh/orbit-prism-command-center](https://github.com/Deanhugh/orbit-prism-command-center)

## Run locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:43140 — default port is `43140`.

## Skills

Skills are markdown playbooks (`skills/<name>/SKILL.md`), not Ollama models. Ollama (or Claude / ChatGPT) is the brain. A skill is the written method an agent should follow.

Two ways to add one:

1. **Upload** from Command Center → Settings → Skills. Drop a `SKILL.md`. It applies immediately and persists on the host (`DATA_DIR/skills`).
2. **GitHub** — add `skills/<name>/SKILL.md` on [the skills folder](https://github.com/Deanhugh/orbit-prism-command-center/tree/main/skills). That file ships on the next Railway deploy and shows a GitHub badge.

Front matter:

```markdown
---
name: inbox-triage
description: How the inbox is triaged each morning
agents: [em_lead, em_client]
department: emails
---
```

See `skills/README.md`.

## Settings

Command Center Settings (`/jarvis/settings`) holds General, Appearance, Account, Providers, MCP, Skills, Social CRM, Greetings, and Sidecar.

## Deploy

Railway auto-deploys from GitHub `main`. Persistent uploads use the `orbit-data` volume at `/app/data`.
