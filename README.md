# Orbit Prism Command Center

Jarvis / Command Center for Orbit Prism. Live:

https://command-center-production-e72e.up.railway.app/

Repo: [Deanhugh/orbit-prism-command-center](https://github.com/Deanhugh/orbit-prism-command-center)

The office is a Next.js app: Jarvis (Today, briefing, calendar), a 3D Agents floor (33 desks), and department boards. Top nav: **Jarvis · Agents · Marketing · Studio · Sales · PMO · CAD · Finance · Vault**. There is no Email / Mautic item in nav.

What landed in this stack:

- **Live** follows OpenRouter (or another HTTP provider), not the Claude CLI
- **Skills** — four originals plus 33 `agency-*` desk playbooks
- **Remote MCP** on Railway — Notion, Apify (scrape), Krea (image/video), GitHub, Stripe
- **Routines** — Morning Brief and Evening Wrap on the dashboard
- **Jarvis Today** — spoken/typed chat that can dispatch office work
- **Jarvis voice** — Fish Audio library TTS (default JARVIS), browser speech as fallback
- **CAD** (`/cad`) and **Studio** (`/studio`) pages, **Finance** (`/finance` / Bigcapital), **Vault** (`/vault`)

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

On Railway, **OpenRouter** is the supported Live path (any OpenRouter model id, including GPT and Claude). A green Test on that row is what flips the office header to Live.

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
  agency-content-strategy/SKILL.md
  your-new-skill/SKILL.md
```

Do not leave skill files at the repo root, in `public/`, or in a random docs folder.

After Railway deploys a commit that includes the files, **Settings → Skills** lists them with a **GitHub** badge and a “View on GitHub” link. A push is not instant in the running app — wait for the deploy to finish, then refresh the Skills page.

The 33 `agency-*` playbooks only show there after that deploy lands. If Settings still lists only `inbox-triage`, `client-report`, `proposal`, and `chief-of-staff`, the live host is on an older commit. Do not point production at an older `main` that predates Live mode, CAD, Studio, or remote MCP.

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
- `department` — grouping on Settings. A named `agents` list binds only those desks (it does not leak to the whole floor). Jarvis still receives `department: all`.

Checked-in examples: `inbox-triage`, `client-report`, `proposal`, `chief-of-staff`, plus one `agency-*` playbook per office desk (33 seats, same ids). Those are condensed from [msitarzewski/agency-agents](https://github.com/msitarzewski/agency-agents) (MIT) — playbooks only, not new agents and not Bash/file tools. Agents never receive Write, Edit, Read, or Bash. See [`skills/README.md`](skills/README.md).

On the Agents floor, the skill picker on a ticket is bound to the **open desk** — only that agent’s playbooks appear. Live work injects about 1,200 characters of each bound skill.

## Settings

Command Center Settings (`/jarvis/settings`) holds **General, Appearance, Account, Providers, MCP, Skills, Routines, Social CRM, Greetings, and Sidecar**. Department platforms (Twenty, Bigcapital, Plane, TryPost) live under **Settings → MCP**.

### Office Live mode

The office header **Live** badge follows the provider you pick in **Settings → Providers** (OpenRouter recommended on Railway). It is **not** tied to the Claude CLI. Demo / Offline only when `ORBIT_MODE=demo`, the Demo provider is selected, or the chosen backend is unreachable. A saved OpenRouter key can still take over if the selected provider is down.

A green tile in **Browse MCP** is not Live. Catalog `npx` / stdio apps stay for a machine with Claude Code. On Railway, an app is live only after you add it as a **remote HTTP/SSE** URL with OAuth or a Bearer token and **Test** is green.

### Remote MCP

On Railway, remote MCP is Streamable HTTP JSON-RPC (`initialize` → `tools/list` → `tools/call`) with `Authorization: Bearer …` or OAuth PKCE. Do not use `/sse` unless the vendor still documents it. Do not use `npx` on the cloud host.

OAuth callback: `{RAILWAY_URL}/api/settings/connectors/oauth/callback`. Tokens sit in `/app/data/secrets.json` on the volume.

#### How to add a catalog app (or any remote URL)

1. Open **Settings → MCP**.
2. Enable the app in **Browse MCP**, *or* **Add a custom MCP**: name, **Remote — HTTP**, paste an `https://` MCP URL, then OAuth or a token.
3. **Connect with OAuth** or **Save token**, then **Test**.
4. Green / `connected` means agents can use it on live tasks. `needs_auth` means the URL is saved but there is no working token yet.

That is the same pattern for Notion, Apify, Krea, GitHub, Stripe, and any other hosted MCP.

#### Notion

1. Open **Settings → MCP** → **Notion — live remote MCP** (or Enable Notion in Browse MCP).
2. **Connect with OAuth**, *or* paste an internal integration token (`ntn_` / `secret_`) and **Save token**.
3. Click **Test**. Green means agents can search the workspace on live tasks.
4. Share Notion pages with the integration if search returns nothing.

URL: `https://mcp.notion.com/mcp`. Optional env: `NOTION_TOKEN` or `NOTION_API_KEY`.

#### Apify (web + social scrape)

Remote Streamable HTTP — not the Apify CLI, not `npx`, not `/sse`. Catalog URL:

`https://mcp.apify.com?tools=actors,apify/rag-web-browser,apify/web-fetch,apify/instagram-scraper,apify/google-search-scraper`

1. Open **Settings → MCP** → **Apify — live remote MCP**.
2. Paste `APIFY_TOKEN` from [Apify Console → Integrations](https://console.apify.com/settings/integrations) and **Save token** (Bearer is the Railway path). **Connect with OAuth** is optional in the browser.
3. Click **Test**. Agents then run scrapers only on live tasks that mention a URL, scrape, or a social network — not on every office task.

Runs bill your Apify account (capped per run: `maxItems` 10, `maxTotalChargeUsd` 1). Optional env: `APIFY_TOKEN`. Rental and full-permission Actors stay excluded.

#### Krea (images + video)

The page at [www.krea.ai/mcp](https://www.krea.ai/mcp) is the setup guide. The Streamable HTTP server the office calls is `https://api.krea.ai/mcp`. Pasting the www URL as a custom MCP is rewritten to the API endpoint.

1. Open **Settings → MCP** → **Krea — live remote MCP**.
2. **Connect with OAuth** (picks the Krea workspace to bill), *or* paste `KREA_API_TOKEN` from [krea.ai/app/api/tokens](https://www.krea.ai/app/api/tokens) and **Save token**.
3. Click **Test**. Agents then generate images/video (Krea 2, list models, poll `get_job`) only on live tasks that mention Krea or ask to generate an image/video — not on every office task.

OAuth bills compute units on the workspace you pick at consent. API tokens bill the workspace API balance. Optional env: `KREA_API_TOKEN`.

#### GitHub and Stripe

Same remote pattern from **Browse MCP**:

| App | MCP URL | Auth |
| --- | --- | --- |
| GitHub | `https://api.githubcopilot.com/mcp/` | OAuth or a PAT the Copilot MCP accepts |
| Stripe | `https://mcp.stripe.com` | OAuth or a restricted API key if the server accepts Bearer |

Enable the tile, connect, **Test**. Local `npx` GitHub/Stripe servers in the catalog are **not** live on Railway.

### Routines (Morning Brief and Evening Wrap)

**Settings → Routines** (`/jarvis/settings?tab=routines`). Times follow the timezone on your profile. State persists in `data/routines.json` on the volume.

- **Dashboard loops:** Morning Brief (weekday 8:00) and Evening Wrap (weekday 18:00) write a dated snapshot onto the Command Center Dashboard (`/jarvis` and `/jarvis/briefing`). They do not spam random desk tickets.
- **Office loops:** inbox triage, invoice chase, competitor scan — default **paused**. Turn one on when you want that desk job on a clock.
- Pause, resume, run now, or add a custom cadence (`every weekday at 9am`). You can also `POST /api/routines`.

### Jarvis Today

The Jarvis home (`/jarvis`) chat — typed or spoken — is **Today**: brief, who is waiting, calendar, then office work. The Today card shows an animated wireframe AI core (not a photo bust). When the owner asks to build, film, invoice, scrape, or generate, Jarvis dispatches the task onto the Agents floor. Every desk may run CRM, Plane, books, TryPost, Studio, CAD, Notion, GitHub, Apify, and Krea. Confirmations stay short and spoken-friendly. Live MCP results (Notion search, Apify scrape, Krea generate) attach when the message matches those apps.

**Voice:** Morning Brief, Evening Wrap, and Today speak through a [Fish Audio](https://fish.audio/) library voice, not the browser’s default system voice. Open **Settings → Voice** (`/jarvis/settings?tab=voice`). Paste `FISH_API_KEY` (or set the same name on Railway), pick a public library voice (default is **JARVIS**), and Preview. `s2.1-pro` is the production model; `s2.1-pro-free` is for prototyping. If the key is missing or Fish is down, the browser `speechSynthesis` path still runs. This is a REST TTS call (`POST /api/jarvis/voice/speak`) — not an MCP connector.

The **+** menu on a desk ticket attaches a Brain note or a local file, and can open Browse MCP without leaving the floor.

## Department platforms on Railway

These are separate Railway projects. Command Center talks to them over HTTP with `*_API_URL` / `*_APP_URL` / `*_API_KEY` (or the Settings card). Do not bake the apps into the Command Center image.

### Twenty CRM — `/sales` (live)

- App: https://server-production-6c63.up.railway.app
- Workspace: **Orbit Prism**
- Command Center vars: `TWENTY_API_URL`, `TWENTY_APP_URL`, `TWENTY_API_KEY`
- Sales board: https://command-center-production-e72e.up.railway.app/sales

Sign into Twenty, then open `/sales`. The board is **live** (not mock) when those three variables are set and `/api/crm/config` reports `reachable: true`. Create or rotate the key in Twenty → Settings → API & Webhooks (key name **Command Center**).

### Bigcapital — `/finance` (books)

Command Center vars: `BIGCAPITAL_API_URL`, `BIGCAPITAL_APP_URL`, `BIGCAPITAL_API_KEY` (optional `BIGCAPITAL_ORG_ID`). Connect under **Settings → MCP → Department platforms**, then open `/finance`.

`/api/finance/config` reports live vs local mock. Unreachable books stay on mock data.

### Plane — `/pmo` (live)

- App: https://plane-production-3665.up.railway.app/orbit-prism/
- Workspace slug: `orbit-prism`
- Command Center vars: `PLANE_API_URL`, `PLANE_APP_URL`, `PLANE_WORKSPACE_SLUG`, `PLANE_API_KEY`
- PMO board: https://command-center-production-e72e.up.railway.app/pmo

`/api/pm/config` reports `mode: live` and `reachable: true`. Tokens live at `{workspace}/settings/account/api-tokens` (key name **Command Center**).

### CAD — `/cad` (text to part)

Orbit-native engineering studio. Left: prompt + engineering-agent build log. Right: Three.js viewport that fills in as solids are placed. This is **not** a vendored CAD kernel (CascadeStudio / Zoo Design Studio / Cursor). Agents emit a box-solid model the browser can mesh.

- Page: https://command-center-production-e72e.up.railway.app/cad
- Agents: Engineering (`op_lead`, `op_intel`, `op_legal`, `op_comply`, `op_dash`) have the `cad` tool (`cad_build`, `cad_list`, `cad_get`)
- Named bodies: Hilbert cube infill, L-bracket, enclosure, mounting plate, flange, shaft. Other prompts get a small parametric stand-in.
- Models persist in `data/cad-models.json` on the host volume.

Prompt on the page yourself, or assign an Engineering task that mentions CAD / bracket / enclosure / Hilbert — the run loop writes the part and links `/cad`.

### Studio — `/studio` (working)

Studio is a working page inside Command Center. Sign in, then open:

https://command-center-production-e72e.up.railway.app/studio

Prompt a film yourself, or pick **Product film / Explainer / Trailer / Reel**. Brand, Content, and Social agents write the cut on the left; the right side plays the shot list. Play, pause, and the timeline work. Productions persist in `data/studio-productions.json` on the host volume.

- Agents: Brand (`mk_gfx`), Content Strategist (`mk_lead`), Social Media (`mk_social`) have the `studio` tool (`studio_produce`, `studio_list`, `studio_get`)
- Named cuts: product film, explainer, trailer, vertical reel, talking-head, documentary. Other prompts get a five-shot branded spot.
- Marketing tasks that mention video / reel / trailer / explainer write a cut and link `/studio`

This is **not** OpenMontage and it does **not** render a finished MP4. There is no Veo, Kling, Remotion, or FFmpeg export. It is the office cut — a playable storyboard — the same way CAD is a text-to-part viewport, not SolidWorks. A real rendered video still needs a separate [OpenMontage](https://github.com/calesthio/OpenMontage) checkout or a video-model key later. Krea MCP (above) is the live path for generated stills and clips when a task asks for an image or video.

### Vault — `/vault` (3D brain)

https://command-center-production-e72e.up.railway.app/vault

The Vault is a 3D graph of every file in the office brain (Markdown with `[[wiki links]]`, plus images and PDFs). Search, filter by category, and open a note. Agents retrieve relevant notes before a live task.

- On a Mac mini, `vaultId` in `office.config.json` resolves through Obsidian’s local registry.
- On Railway the brain is the `/app/brain` volume (`ORBIT_BRAIN`). Put notes there; do not expect the Mac Obsidian path to exist in the container.
- Private overrides: `office.config.local.json` (gitignored).

### TryPost — `/marketing` (blocked on image)

Railway project **Orbit Prism TryPost** exists (app + Postgres + Redis). `ghcr.io/trypostit/trypost:latest` and `v1.0.8` crash on boot (`Laravel\\Pail\\PailServiceProvider` not found). Leave `/marketing` on mock until a working image is published. Then set `TRYPOST_API_URL`, `TRYPOST_APP_URL`, `TRYPOST_API_KEY`.

## Deploy

Railway builds Command Center from the GitHub branch connected to the **command-center** service. Persistent data uses the `orbit-data` volume at `/app/data`. Full host notes: [`DEPLOY.md`](DEPLOY.md).

For **Live** on Railway: set **Settings → Providers** to **OpenRouter**, save `OPENROUTER_API_KEY` (or the same name as a Railway variable), pick a model such as `openai/gpt-4.1-mini`, then **Test**. The header flips to Live from that provider — not from the Claude CLI.

Optional MCP tokens (same names as Settings → MCP) if you prefer env over the UI:

| Variable | App |
| --- | --- |
| `OPENROUTER_API_KEY` | Live LLM |
| `NOTION_TOKEN` / `NOTION_API_KEY` | Notion |
| `APIFY_TOKEN` | Apify scrape |
| `KREA_API_TOKEN` | Krea image/video |

OAuth and pasted tokens also land in `/app/data/secrets.json`. Custom connectors persist in `/app/data/connectors.json`. Routines persist in `/app/data/routines.json`. CAD and Studio files are `cad-models.json` and `studio-productions.json` on the same volume.

OAuth callback the vendor must allow: `{RAILWAY_URL}/api/settings/connectors/oauth/callback`.
