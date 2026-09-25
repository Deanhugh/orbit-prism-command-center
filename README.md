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

Skills are markdown playbooks the Command Center injects into an agent’s prompt. They are **not** Ollama models. Ollama (or Claude / ChatGPT) is the brain. A skill is the written method that agent should follow.

List and add them at **Settings → Skills**:
https://command-center-production-e72e.up.railway.app/jarvis/settings?tab=skills

### GitHub folder

Put every playbook in [`skills/`](https://github.com/Deanhugh/orbit-prism-command-center/tree/main/skills) at the repo root — one folder per skill, file named `SKILL.md`:

```
skills/
  inbox-triage/SKILL.md
  client-report/SKILL.md
  proposal/SKILL.md
  your-new-skill/SKILL.md
```

Do not leave skill files at the repo root, in `public/`, or in a random docs folder.

After you push to `main`, Railway deploys that commit, then **Settings → Skills** lists the new playbooks with a **GitHub** badge and a “View on GitHub” link. A push is not instant in the running app — wait for the deploy to finish, then refresh the Skills page.

A loose `skills/something.md` also works if it starts with YAML front matter. Prefer `skills/<name>/SKILL.md`. See [`skills/README.md`](skills/README.md).

### Upload on the Skills page

Drop a `SKILL.md` (or click to choose) on **Settings → Skills**. It applies immediately and persists on the host (`DATA_DIR/skills` on Railway). Badge: **Uploaded**. Uploads do not write back to GitHub — add the same file under `skills/` if you want it versioned.

You can also fill in **Write a skill** on that page.

### SKILL.md format

```markdown
---
name: inbox-triage
description: How the inbox is triaged each morning
agents: [em_lead, em_client]
department: emails
---
# Triaging the inbox

1. Sort into: needs the owner, an agent can handle, FYI, noise.
```

- `name` — slug shown on the Skills page
- `description` — one-line summary
- `agents` — agent ids from the office, or `all`
- `department` — department id, or `all`

Checked-in examples: `inbox-triage`, `client-report`, `proposal`.

## Settings

Command Center Settings (`/jarvis/settings`) holds General, Appearance, Account, Providers, MCP, Skills, Social CRM, Greetings, and Sidecar.

## Deploy

Railway auto-deploys from GitHub `main`. Persistent uploads use the `orbit-data` volume at `/app/data`.
