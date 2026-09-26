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

## Providers — ChatGPT, Claude, and others

Yes. ChatGPT models connect in **Settings → Providers** with an OpenAI API key. Claude in that same list is **Claude Code (the CLI on the machine)**, not an Anthropic API-key field.

Providers page:
https://command-center-production-e72e.up.railway.app/jarvis/settings?tab=providers

Keys pasted in Settings are stored in `data/secrets.json` on the host (gitignored), or you can set the same names as Railway / env variables.

### ChatGPT / OpenAI

1. Open **Settings → Providers**.
2. At the top, set **Active model** to **OpenAI**.
3. In the model box, type a ChatGPT model name, for example `gpt-4o` or `gpt-4.1`, then **Save**.
4. In the **OpenAI** row:
   - Leave **Base URL** as `https://api.openai.com/v1` (or save that if it is empty).
   - Paste your key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) into **API key**.
   - Click **Save**, then **Test**.
5. A green dot means the Command Center can reach OpenAI. Agents (including Jarvis) then use that model.

You can also set `OPENAI_API_KEY` as a Railway variable instead of pasting it in the UI.

### Claude

**Option A — Claude Code (what the Settings row is)**

The **Claude Code (CLI)** provider does not take an Anthropic key in Settings. It runs the `claude` command on the same machine as the app.

1. On that machine, install Claude Code and log in (`claude` on your PATH).
2. In **Settings → Providers**, set **Active model** to **Claude Code (CLI)**.
3. Type `sonnet`, `opus`, or `fable`, then **Save**.
4. Click **Test** on that row.

That works on a Mac mini running `npm run dev`. It will not work on Railway unless the `claude` CLI is installed and logged in inside that container.

**Option B — Claude models via API key (works on Railway)**

Settings does not have a separate “Anthropic API” card. Use **OpenRouter** and pick a Claude model:

1. Create a key at [openrouter.ai](https://openrouter.ai).
2. In **Settings → Providers**, set **Active model** to **OpenRouter**.
3. Type a Claude model id, for example `anthropic/claude-sonnet-4`, then **Save**.
4. In the **OpenRouter** row, leave Base URL as `https://openrouter.ai/api/v1`, paste `OPENROUTER_API_KEY`, **Save**, **Test**.

### Other cloud providers

**xAI Grok**, **Groq**, and **Together AI** work the same way: pick the provider, paste that row’s key (`XAI_API_KEY`, `GROQ_API_KEY`, `TOGETHER_API_KEY`), type the model name, Save, Test. If a provider fails, agents fall back to demo until the test is green.

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
- `agents` — agent ids from the office (`jarvis` / `chief` for the Chief of Staff), or `all`
- `department` — department id, or `all`

Checked-in examples: `inbox-triage`, `client-report`, `proposal`, `chief-of-staff`.

## Settings

Command Center Settings (`/jarvis/settings`) holds General, Appearance, Account, Providers, MCP, Skills, Social CRM, Greetings, and Sidecar. Department platforms (Twenty, Bigcapital, Plane, TryPost, Mautic) live under **Settings → MCP**.

## Department platforms on Railway

These are separate Railway projects. Command Center talks to them over HTTP with `*_API_URL` / `*_APP_URL` / `*_API_KEY` (or the Settings card). Do not bake the apps into the Command Center image.

### Twenty CRM — `/sales` (live)

- App: https://server-production-6c63.up.railway.app
- Workspace: **Orbit Prism**
- Command Center vars: `TWENTY_API_URL`, `TWENTY_APP_URL`, `TWENTY_API_KEY`
- Sales board: https://command-center-production-e72e.up.railway.app/sales

Sign into Twenty, then open `/sales`. The board is **live** (not mock) when those three variables are set and `/api/crm/config` reports `reachable: true`. Create or rotate the key in Twenty → Settings → API & Webhooks (key name **Command Center**).

### Plane — `/pmo` (app up, Command Center still mock until PAT)

- App: https://plane-production-3665.up.railway.app
- First-run: https://plane-production-3665.up.railway.app/god-mode/
- Create workspace slug `orbit-prism`, then a Personal Access Token named **Command Center**
- Command Center vars: `PLANE_API_URL`, `PLANE_APP_URL`, `PLANE_WORKSPACE_SLUG`, `PLANE_API_KEY`
- PMO board: https://command-center-production-e72e.up.railway.app/pmo

Until those four variables are set, `/pmo` uses local mock projects.

### TryPost — `/marketing` (blocked on image)

Railway project **Orbit Prism TryPost** exists (app + Postgres + Redis). `ghcr.io/trypostit/trypost:latest` and `v1.0.8` crash on boot (`Laravel\\Pail\\PailServiceProvider` not found). Leave `/marketing` on mock until a working image is published. Then set `TRYPOST_API_URL`, `TRYPOST_APP_URL`, `TRYPOST_API_KEY`.

## Deploy

Railway auto-deploys Command Center from GitHub `main`. Persistent uploads use the `orbit-data` volume at `/app/data`.
