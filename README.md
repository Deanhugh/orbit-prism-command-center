# Orbit Prism Operating System

A 3D isometric office where AI agents do real work on **your** models — recommended: **Ollama**
(local on a Mac mini, plus Ollama Cloud for larger models).

Six departments around a central **Brain**, a chat that routes what you ask to the right agent,
MCP/CLI connectors you add from Settings, a Markdown Brain you can open as a graph, per-agent
skills, and routines that run on a clock. Message an agent (or Chief), the office gives the work to
the right agent, they read your notes, use the connectors you've set up, do the work, and file the
result back into your notes. There are also live platform integrations per department — Sales
(Twenty), Finance (Bigcapital), PMO (Plane), Marketing (TryPost), and Email (Mautic).

> This is an original project. It is **not** affiliated with, and does not reuse the code of, any
> other "agents office" product. It was built from scratch to explore the same idea.

![The office](assets/readme-hero.webp)

Prefer the dark? Press **D**.

![The office in dark mode](assets/readme-hero-dark.webp)

## Two ways it runs

| Mode | When | What works |
|---|---|---|
| **LIVE · CLAUDE** | `claude` CLI is installed and logged in on the machine | Real agent work via `claude -p`, live MCP connectors from `claude mcp list`, Brain write-back |
| **DEMO** | No `claude` CLI (or `ORBIT_MODE=demo`) | The whole office, task routing, progress, routines, Brain graph and skills — with simulated agent work |

The badge in the top bar tells you which mode you are in. Click it to re-check.

**Agent chat** is separate from that Claude CLI path. Chat uses the provider you pick in Settings
(recommended: **Ollama**). See [Ollama (recommended LLM)](#ollama-recommended-llm--local--cloud).

## What you need

- Node.js 20+ — https://nodejs.org
- **Ollama** (recommended LLM) — https://ollama.com — for local models on this machine and optional
  Ollama Cloud models. See the [Ollama setup](#ollama-recommended-llm--local--cloud) below.
- Optional, for live *task-engine* work via the Claude CLI: **Claude Code**, installed and logged in
  (`claude` on your PATH), plus any MCP servers you have added with `claude mcp add`.

## Run it

```bash
npm install
npm run dev        # → http://localhost:43140
```

Or a production build (no hot-reload websocket — use this if Preview hangs on “Connecting…”):

```bash
npm run build
npm start          # → http://localhost:43140
```

There is also a helper:

```bash
./setup            # checks Node + claude, installs, builds
```

## Jarvis

After login you land on **Jarvis** (`/jarvis`) — the command deck. JARVIS briefs you in
plain language: clock and day progress, tasks, the next calendar blocks, a morning/evening
brief, and habits. The left rail opens Briefing, Calendar, Knowledgebase, Notepad,
Scheduling Agent, Social CRM, Meeting Intel, How to Use, and Settings. The OS uses a
single Orbit Prism brand style (Inter, JetBrains Mono, cyan on #0A0514). The Agents
office is still at `/agents`. The lock screen is unchanged.

### Today · Jarvis

The **Today** box on the Command Center is the day snapshot: clock, greeting, and what is due
or slipped. It is not a conversation panel. Chat with agents from the Agents office (`/agents`).

## Sign in

On first launch, open http://localhost:43140 — you'll be sent to **/login**. This app keeps its
**own** accounts in `data/users.json` on that machine. It is **not** your Mac password, iCloud, or
the account you made on a public preview link.

- **First time on this Mac:** enter a password (6+) on the lock screen and press **Enter**.
- **Already unlocked here:** enter the password you set on this copy. There is no username field.
- **Skip the form:** open http://localhost:43140/api/auth/guest — that sets a session and sends you
  to **Jarvis**, the command deck. The Agents office is still at `/agents`.
- **Stuck session:** open http://localhost:43140/api/auth/logout then create an account again.

Stay on `http://localhost:43140` (not `127.0.0.1`) so the cookie matches. After signing in you land
on **Jarvis** (`/` and `/jarvis`). Sessions are a signed, http-only cookie.

Every page shows the **Orbit Prism · Operating System Command Center** wordmark in the top-left, and a
top nav: **Agents · Marketing · Email · Sales · PMO · Finance · Vault · Settings**.

## Orchestration (Jarvis)

The office's orchestration layer runs behind the scenes and is driven from the **Agents** page by
chatting with **Chief** (Jarvis) — there's no separate Command Center page anymore; it's folded in.

- **Jarvis — Chief of Staff.** The one persona you brief. Every department lead (and their agents)
  reports up to Jarvis; Jarvis reports to you. Describe an outcome ("research pricing then draft a
  proposal then email it") and Jarvis breaks it into steps, assigns each through the right department
  lead, chains them with **dependencies**, and escalates anything outbound for your approval.
- **Task engine.** Tasks move through Backlog → Blocked → In progress → Waiting → Done/Stopped. Tasks
  with dependencies stay *Blocked* until their prerequisites finish, then start automatically. The
  animated **Office scene** on the Agents page lights up desks as agents work.
- **Budgets + circuit breaker.** Each agent has a budget with an `ok → steer → constrain → stopped`
  breaker; reset it to resume. Agents keep a running **memory** of what they've done.
- **The hive.** Agent-to-agent and agent-to-Jarvis messages flow under the hood.
- **Routines.** Scheduled tasks (say a cadence like "every weekday at 8am…") run on the server clock.

## Jarvis V.A.U.L.T — the 3D Brain

![The Jarvis V.A.U.L.T 3D Brain](assets/readme-vault.webp)

The Vault (`/vault`) is a **full-screen interactive 3D Brain** of your Obsidian vault:

- **Every file is a node** — notes *and* attachments (images, PDFs, `.canvas`, and other files),
  colored by category, around a glowing central orb. Drag to orbit, scroll to zoom.
- **Real connections** — `[[wiki links]]`, note embeds (`![[image.png]]`), `.canvas` file links,
  and bound skills all become edges.
- **Search** your brain, **click any node to read it** (notes render as text; images and PDFs
  preview inline), and **solo/toggle categories** in the legend (click to toggle, double-click to
  solo).
- **Rotate/Pause** the graph, **Play demo** for a growth replay, and **Cinema** for a clean
  presentation view with a live node counter.
- **Jarvis stays** as an overlay: the command deck, push-to-talk voice, and chat.
- A header chip shows **Obsidian vault** (connected) or **Sample brain** (fallback). It reads the
  vault on whatever machine it runs on — see [OBSIDIAN.md](OBSIDIAN.md).

The 3D-brain experience is adapted from **[AIS-OS](https://github.com/nateherkai/AIS-OS)** by
Nate Herk (MIT) — re-implemented natively in this project's stack and design. The category palette
follows that project. See [Credits](#credits).

## Agents & platforms (chat + workspace)

The authenticated app, all in the top-bar nav:

- **Agents** (`/agents`) — the **home** page and the multi-agent workspace, in two columns:
  - **Left:** the agent list on top — **collapsible by department**, each agent showing a
    green/yellow/red **shift-status** dot (working / winding down / not active) — and **underneath it
    the animated 3D Office scene** (the isometric pods around the central Brain; click a pod to focus a
    department, click the Brain to open the graph). Your **profile / sign-out** sits at the very bottom.
  - **Right:** the **chat**. DM any of the 33 agents, message a **department group thread**, or talk to
    **Chief** (Jarvis). Replies stream in, tool steps render as a checklist, and the composer has a mic
    (push-to-talk), a **per-agent model picker**, and a **+** menu like Cursor: **Files** (Brain search
    or upload), **Skills**, and **MCP Servers** (search / enable the same catalog as Settings).
  - You assign work by **just messaging the agents** (the old separate task bar has been folded into
    chat; the standalone "Office" page/tab was removed and the scene now lives here).

![Agents Messages](assets/readme-agents.webp)

- **Settings** (`/settings`) — manage **Providers** (pick the active model, set base URLs and API
  keys, test connections), **MCP** (**Browse** a catalog of apps and Enable them, or **Add** a custom
  command / URL — `stdio`/`SSE`/`HTTP` — with allow/block and remove, plus the built-in platform
  connections), **Skills** (list and create), and **Plugins** (enable Composio tools). Enabling an MCP
  from chat or Settings runs `claude mcp add` when Claude Code is present, and is saved to
  `data/connectors.json` so it shows up regardless. Keys are stored locally in `data/secrets.json`
  (gitignored) or read from env.

![Settings — providers](assets/readme-settings.webp)

- **Sales** (`/sales`) — a deal-flow board backed by [**Twenty**](https://github.com/twentyhq/twenty),
  the open-source CRM. A **Platform** view embeds the real Twenty app (with "Open in Twenty ↗") and a
  **Board** view shows the pipeline (New → Screening → Meeting → Proposal → Won). **Sales agents read
  and write these same deals**. See the full [CRM (Twenty)](#crm-twenty--deal-flow-for-the-sales-team)
  section below for what the agents can do and how to connect your instance.

- **Finance** (`/finance`) — the books, backed by [**Bigcapital**](https://github.com/bigcapitalhq/bigcapital),
  the open-source accounting platform. A dashboard (cash, AR, AP, revenue, net, overdue) plus invoices,
  bills, and payments. **Finance agents read and write the books** — raising invoices, recording bills,
  taking payments, and reconciling. See the full [Finance (Bigcapital)](#finance-bigcapital--the-books-for-the-finance-team)
  section below.

- **PMO** (`/pmo`) — project management, backed by [**Plane**](https://github.com/makeplane/plane), the
  open-source Jira/Linear alternative. The page **embeds the full Plane platform** (with an "Open in
  Plane ↗" link) and adds a **Board** view (Kanban by state). Shared by **Engineering + PMO agents**:
  the PMO plans work items and Engineering advances them — both read & write the same Plane projects.
  See the full [PMO (Plane)](#pmo-plane--shared-project-management-for-engineering--pmo) section below.

- **Marketing** (`/marketing`) — social scheduling, backed by [**TryPost**](https://github.com/trypostit/trypost),
  the open-source social scheduler. The page **embeds the full TryPost platform** (with "Open in TryPost ↗")
  and adds a **Calendar** view (posts by state: Draft → Scheduled → Published). The **Social Media
  Strategist, Content Strategist & Brand** agents draft, schedule and publish these same posts. See the
  full [Marketing (TryPost)](#marketing-trypost--social-scheduling-for-the-marketing-team) section below.

- **Email** (`/email`) — email marketing automation, backed by [**Mautic**](https://github.com/mautic/mautic).
  The page **embeds the full Mautic platform** (with "Open in Mautic ↗") and adds a **Board** (emails,
  campaigns, contacts). The **Email Marketing** agent drafts and sends real campaigns. See the full
  [Email (Mautic)](#email-mautic--email-marketing-for-the-email-marketing-agent) section below.

Chat runs behind one **provider switch** (OpenAI-compatible HTTP). **Ollama is the recommended
route** — local models and Ollama Cloud models share the same Settings row. Full setup:
[Ollama (recommended LLM)](#ollama-recommended-llm--local--cloud).

| Provider | How | Needs |
|---|---|---|
| **Ollama (recommended)** | `http://localhost:11434/v1` | Ollama app running; `qwen2.5:7b` locally; `ollama signin` for `:cloud` models |
| **LM Studio** (local) | `http://localhost:1234/v1` | `lms server start` + a loaded model |
| **xAI Grok** (cloud) | `https://api.x.ai/v1` | `XAI_API_KEY` |
| **OpenAI / OpenRouter / Groq / Together** | their `/v1` URLs | the matching API key in Settings |
| **Claude** | existing Claude Code CLI | logged-in `claude` |
| **Demo** | built-in | nothing (simulated streams) |

Optional **Composio** tool layer (`COMPOSIO_API_KEY`) lets agents call extra SaaS apps (Gmail, Slack,
Salesforce, …). It is **not** a substitute for Ollama or for the built-in CRM / Finance / PMO /
Marketing / Email tools. Without Composio, those extra SaaS tool steps are simulated. Set the
provider/model from Settings and from the per-agent pills in the Agents chat composer. On the cloud
preview everything runs in **Demo**; connect Ollama on your Mac mini to go live.

Env vars: `XAI_API_KEY`, `COMPOSIO_API_KEY`,
`TWENTY_API_URL`, `TWENTY_APP_URL`, `TWENTY_API_KEY` (Twenty CRM), `BIGCAPITAL_API_URL`, `BIGCAPITAL_APP_URL`,
`BIGCAPITAL_API_KEY`, `BIGCAPITAL_ORG_ID` (Bigcapital / Finance), `PLANE_API_URL`, `PLANE_APP_URL`,
`PLANE_WORKSPACE_SLUG`, `PLANE_API_KEY` (Plane / PMO), `TRYPOST_API_URL`, `TRYPOST_APP_URL`,
`TRYPOST_API_KEY` (TryPost / Marketing), `MAUTIC_API_URL`, `MAUTIC_APP_URL`, `MAUTIC_CLIENT_ID`,
`MAUTIC_CLIENT_SECRET` (Mautic / Email).

## Ollama (recommended LLM) — local + Cloud

This is the supported way to give every Orbit Prism agent a real model. You install **one** Ollama
app on the Mac mini. Everyday work runs a small open model **on the machine**. Harder work can use
a larger model on **Ollama Cloud** without changing provider in Settings — you only change the
model name.

Ollama Cloud is still Ollama. A `:cloud` model is forwarded from `localhost:11434` to Ollama’s
servers after you sign in. Orbit Prism does not need a second provider, Together, or LM Studio for
this path.

**Recommended machine:** Mac mini M4 with **16 GB** unified memory (fan-cooled, always-on). No
NVIDIA GPU, so do not install NVIDIA NIM or CUDA.

### 1. Install Ollama (once)

1. Download the Mac app from [ollama.com](https://ollama.com) and open it.
2. Leave the menu-bar app running whenever Orbit Prism is running.
3. In Terminal, confirm the local API:

```bash
curl http://localhost:11434/v1/models
```

If that fails, Ollama is not running. Open the app and try again.

### 2. Local models (stay on the Mac mini)

On 16 GB, stay in the **7–9B Q4** class. One model loaded at a time. All 34 agents (Jarvis + 33
desks) can share that single model — they are different jobs and tools, not different weights.

```bash
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
ollama pull deepseek-r1:8b
```

If your Ollama catalog has `qwen3.5:9b`, use that instead of `qwen2.5:7b` (same size, stronger).

| Use | Model | Notes |
|---|---|---|
| **Default for every agent** | `qwen2.5:7b` | Daily chat, drafts, CRM/Finance/PMO tool calls |
| Straightforward instruction-following | `llama3.1:8b` | Swap in the chat pills when you want it |
| Harder reasoning (still local) | `deepseek-r1:8b` | Slower; still one model in memory |

**Do not pull on 16 GB:** Mixtral, 14B+, 27B, 70B, Nemotron Super. Those swap to disk and crawl.

Keep context modest (**8K–16K**). Talk to **one agent at a time**. Expected feel: about 15–25
tokens/sec on an M4.

Local models do not need an API key. Weights live under Ollama’s data directory (usually
`~/.ollama/models`). After the first pull they work offline.

### 3. Ollama Cloud (larger models, same Settings row)

For models that will not fit in 16 GB, sign in once. Cloud prompts leave the machine (Ollama states
they are not used for training). Usage is billed — check [ollama.com](https://ollama.com) plans.

```bash
ollama signin
```

Then either run a cloud model from Terminal to register it, or pick it in Orbit Prism after it
appears in the model list:

```bash
ollama run gpt-oss:120b-cloud
```

Names vary by catalog. In the app/CLI they usually look like `gemma4:cloud` or
`something:120b-cloud`. Browse current cloud models at [ollama.com](https://ollama.com) or:

```bash
curl https://ollama.com/api/tags
```

**Direct `https://ollama.com` + `OLLAMA_API_KEY`** is optional (CI, no local daemon). You do not
need that for Orbit Prism on the mini. Signed-in local Ollama is enough: Orbit Prism still calls
`http://localhost:11434/v1`.

To stay local-only, do not sign in — or disable cloud features in the Ollama app.

### 4. Point Orbit Prism at Ollama

Run Orbit Prism **on the same Mac mini** (`npm run dev` or `npm start`). The hosted cloud preview
cannot see your Ollama.

1. Open **Settings** (gear next to Sign out on the Agents page) → **Providers**.
2. Set **Active model** to **Ollama (local + Cloud)**.
3. Base URL: `http://127.0.0.1:11434/v1` (the default — leave it). If you previously saved `localhost`, change it to `127.0.0.1` and Save.
4. Model: type or pick the name from `ollama list` (often `qwen2.5:7b`). You can type it even if the list says empty, then **Save**.
5. Click **Save** next to the base URL, then **Test** on the Ollama row. A banner at the top of
   Settings will say **Saved** / **Test passed. Connected** or **Test failed** with the reason.
6. On **Agents**, open a conversation and set the composer pills to **Ollama** + that model.
   Each agent remembers its own pick.

No Ollama API key goes in Settings for localhost. Do not paste OpenAI / Grok / Together keys
unless you deliberately switch away from this route.

### If Settings shows “no models” / orange Ollama

That means **this Orbit Prism process cannot reach Ollama**, so it cannot fill the dropdown. **Test**
does not install a model — it only pings `127.0.0.1:11434`. Typical causes:

1. **You are on the cloud preview** (a `trycloudflare.com` or similar URL). That server is not your
   Mac. Ollama on the mini is invisible to it. Run the app locally:

   ```bash
   cd /path/to/orbit-prism
   npm install
   npm run dev        # → http://localhost:43140
   ```

   Then open **http://localhost:43140** (not the preview link) → Settings.

2. **Ollama is installed but the API is down.** Leave the Ollama menu-bar app running, then:

   ```bash
   ollama list
   curl http://127.0.0.1:11434/api/tags
   ```

3. **The model you downloaded is not named `qwen2.5:7b`.** A library card such as
   `R4C3R/qwen2.5-coder-7b-instruct-heretic` pulls as something like
   `r4c3r/qwen2.5-coder-7b-instruct-heretic:q4_k_m`. Use that exact name from `ollama list`.
   To get the official 7B instead:

   ```bash
   ollama pull qwen2.5:7b
   ollama list
   ```

Local Ollama will never pass Test from the Cursor cloud preview (`localhost:43140` in your
browser is forwarded to the cloud app). On the Mac, `curl http://127.0.0.1:11434/api/tags` checks
Ollama itself. To use models from the preview, set Base URL to `https://ollama.com/v1` and paste
an Ollama Cloud API key. To use `qwen2.5:7b` on the mini, run `npm run dev` on that Mac and open
**that** localhost:43140.

### 5. How to use both day to day

| Work | Model in the chat pills |
|---|---|
| Sales, Finance, PMO, Marketing, Email, Account Management | `qwen2.5:7b` (local) |
| Jarvis routing a messy brief, Engineering specs, long plans | a `:cloud` model |

Switch back to `qwen2.5:7b` when the hard job is done so you are not paying Cloud for every draft.

The **tools** (Twenty, Bigcapital, Plane, TryPost, Mautic) still do the real writes. The model is
the speaker and the decision layer. A 7B is a capable junior for every desk; Cloud is the upgrade
for the few jobs that need more headroom.

### 6. If chat falls back to Demo

- Ollama is not running, or Orbit Prism is not on the same machine.
- The model name is wrong (not pulled, or Cloud but you have not signed in).
- The base URL is not `http://127.0.0.1:11434/v1`.
- You are on the cloud preview instead of `http://localhost:43140` on the mini.

### Composio (optional, not the LLM)

Settings → **Plugins** → `COMPOSIO_API_KEY` is only for extra SaaS tools (Gmail, Slack, Notion, …).
It does not run models and it does not replace Ollama or the built-in department platforms.

## CRM (Twenty) — deal flow for the Sales team

The CRM is a real backend, not a mock-up: it's [**Twenty**](https://github.com/twentyhq/twenty), the
open-source CRM, integrated over its auto-generated REST API. Deals are Twenty **opportunities**;
companies and people are the accounts and contacts.

**Who can use it.** The entire **Sales team** is wired to the CRM — all six agents (Sales Lead, Lead
Enricher, Inbound Manager, Prospector, Proposals, Follow Ups) carry the `crm` tool. Other departments
(PMO, Account Management, Engineering, Finance, Marketing) are intentionally **not** connected — deal
flow is Sales-owned.

**What the agents can do** (each maps to a real Twenty API call):

| Tool | Action |
|---|---|
| `crm_list_deals` | List/filter the pipeline by stage or search text |
| `crm_get_deal` | Read one deal (amount, stage, company, contact) |
| `crm_create_deal` | Open a new opportunity (name, amount, stage, close date, company/contact) |
| `crm_update_deal` | Move stage, mark won, change amount or close date |
| `crm_list_companies` / `crm_create_company` | Read / add accounts |
| `crm_list_people` / `crm_create_person` | Read / add contacts |

**Two ways it runs, both hitting the real backend:**

1. **Sales tasks** (Office → add a Sales task, or a routine). The agent automatically touches the CRM:
   - *"Open a new deal for Globex worth $95k"* → creates the opportunity at stage New.
   - *"Move the Meridian deal to proposal"* / *"Mark Harbourside closed-won"* → advances or wins it.
   - Any other Sales task → the agent reads a live pipeline snapshot to ground its work.
   The created/updated deal shows on the `/crm` board and in the task's deliverable.
2. **Chatting with a Sales agent** (Agents → DM a Sales agent or the Sales group). With a model
   provider connected (LM Studio or Grok), the agent calls the CRM tools directly ("what's in our
   pipeline?", "create a $40k deal for Northwind"). In pure demo mode the chat tool-calls are
   simulated, but the Sales-task path above still performs genuine reads/writes.

**Workflow it enables.** Sales closes a lead → the Sales Lead marks the deal **Won** and does the
**warm transfer** to Account Management, who own the account from there.

**Two views on the CRM page** (like Finance & PMO): a **Platform** view that **embeds the real Twenty
app** (with an "Open in Twenty ↗" link; the hosted cloud blocks iframing so it falls back to the link —
a self-hosted Twenty embeds inline), and a **Board** view (the agent-activity pipeline).

**Connect your instance.** In **Settings → Connectors → CRM**, set the **API base URL**, the **App URL**
(the Twenty web address, for the embed/link), and an **API key** (created in Twenty under *Settings →
API & Webhooks*). Or use env vars `TWENTY_API_URL` (default `https://api.twenty.com`;
`http://localhost:3000` for self-hosted), `TWENTY_APP_URL` (the UI, e.g. `https://app.twenty.com`), and
`TWENTY_API_KEY`. Keys are stored locally in `data/secrets.json` (gitignored). **Until you connect an
instance, the CRM runs on seeded local mock data** so everything works out of the box; the connector
card and the page show whether you're on **live** or **mock**.

> Note: search/filtering is currently done client-side after a `limit`ed fetch (robust across Twenty
> versions). For very large pipelines this can be switched to Twenty's server-side `filter=` syntax
> and cursor pagination in `src/lib/server/twenty.ts`.

## Finance (Bigcapital) — the books for the Finance team

The Finance page is a real accounting backend: [**Bigcapital**](https://github.com/bigcapitalhq/bigcapital),
the open-source double-entry platform, integrated over its Core REST API. It powers a books dashboard
(cash position, AR outstanding, AP owed, revenue, net, overdue, unreconciled) plus tabs for
**invoices** (AR), **bills** (AP), and **payments**.

**Who can use it.** The **Finance team** is wired to the books — all four agents carry the
`bigcapital` tool: the **Comptroller** (Head of Finance), **Invoicing**, **Payables**, and
**Reconciliation**. No other department has access.

**What the agents can do** (each maps to a real Bigcapital API call):

| Tool | Action |
|---|---|
| `finance_summary` | Cash, AR, AP, revenue, expenses, net, overdue, unreconciled |
| `finance_list_invoices` / `finance_create_invoice` / `finance_update_invoice` | List/raise invoices; mark PAID, change amount/due |
| `finance_list_bills` / `finance_create_bill` / `finance_update_bill` | List/record bills; APPROVE or mark PAID |
| `finance_list_payments` / `finance_record_payment` | List payments; record money in/out |
| `finance_reconcile` | Match a bank line (payment) to an invoice/bill |
| `finance_list_accounts` | Read the chart of accounts (name, code, type, balance) |

The Dashboard also has a **Chart of accounts** tab (mirroring Bigcapital's own view), and there's a
diagnostics endpoint (`/api/finance/diagnostics`) that probes the live Bigcapital endpoints once a key
is set — used to validate/tune the response mappers against your instance.

**Two ways it runs, both hitting the real backend:**

1. **Finance tasks** (Office → add a Finance task, or a routine). The agent touches the books:
   - *"Raise an invoice for Meridian for $13.6k"* → creates the invoice.
   - *"Record a bill from AWS for $4.2k"* → records the payable.
   - *"Mark the Harbourside invoice paid"* → marks PAID and logs the payment received.
   - *"Reconcile the bank"* → matches the next unreconciled payment.
   - *"Chase overdue"* → lists overdue invoices. Any other task → a books snapshot (real read).
   Changes appear on the `/finance` page (which polls live) and in the task's deliverable.
2. **Chatting with a Finance agent** (Agents → DM a Finance agent or the Finance group). With a model
   provider connected, the agent calls the finance tools directly. In demo mode the chat tool-calls are
   simulated, but the Finance-task path above still performs genuine reads/writes.

**Two views on the Finance page.** A **Dashboard** (our agent-activity view — KPIs, invoices, bills,
payments) and **Full books**, which **embeds the real Bigcapital web app** in an iframe with a
guaranteed **"Open in Bigcapital ↗"** link (some instances block iframing via security headers, in
which case the link opens it in a new tab). So you get both the agent-activity summary *and* the
actual Bigcapital platform in one place.

**Connect your instance.** In **Settings → Connectors → Finance**, set the **API base URL**, the
**App URL** (the Bigcapital web address, used for the embed/link), and an **API key** (created in
Bigcapital). Or use env vars `BIGCAPITAL_API_URL` (default `https://api.bigcapital.com`;
`http://localhost:3000` for self-hosted), `BIGCAPITAL_APP_URL` (the UI, e.g. `https://app.bigcapital.com`),
and `BIGCAPITAL_API_KEY` (a `bc_…` key; set `BIGCAPITAL_ORG_ID` too if you use a JWT token). Keys are
stored locally in `data/secrets.json` (gitignored). **Until you connect an instance, the Finance page
runs on seeded local mock books** so it's fully populated out of the box, then flips to your live
books once configured.

## PMO (Plane) — shared project management for Engineering + PMO

The **PMO** page is powered by [**Plane**](https://github.com/makeplane/plane), the open-source
project-management platform (Jira/Linear/ClickUp alternative). It's the shared surface where the
**PMO** plans work and **Engineering** executes it. The page has two views:

- **Platform** — **embeds the full, exact Plane app** in an iframe (with a guaranteed "Open in Plane ↗"
  link; some instances block iframing via security headers, in which case the link opens a new tab).
- **Board** — an agent-activity Kanban (Backlog → Todo → In Progress → Done / Cancelled) built on the
  Plane API, with add + drag-across-state, that reflects what the agents do.

**Who can use it.** Both the **Engineering** (`ops`) and **PMO** (`emails`) agents carry the `plane`
tool. The PMO's Program Manager + Project Managers create and prioritise work items; the Engineering
agents (Agent Builder, Command Center, IoT, AI Integrations) pick them up and move them along.

**What the agents can do** (each maps to a real Plane API call):

| Tool | Action |
|---|---|
| `pm_summary` | Project count + work-item counts by state + urgent |
| `pm_list_projects` / `pm_create_project` | List / create projects |
| `pm_list_work_items` | List/filter work items by project, state, or search |
| `pm_create_work_item` | Create a work item (PMO plans work for Engineering) |
| `pm_update_work_item` | Move state (start/complete), reprioritise, reassign |

When an **Engineering or PMO task** runs, the agent touches Plane: e.g. *"Create a task to build the
Meridian intake agent"* → creates a work item; *"Mark the eval harness done"* → moves it to Done. The
change shows on the PMO Board and in the task deliverable.

**Connect your workspace.** In **Settings → Connectors → PMO**, set the **API base URL**, **App URL**
(for the embed/link), **Workspace slug** (from your Plane URL, e.g. `app.plane.so/my-team` → `my-team`),
and an **API key** (`plane_api_…`). Or use env vars `PLANE_API_URL` (default `https://api.plane.so`),
`PLANE_APP_URL` (default `https://app.plane.so`), `PLANE_WORKSPACE_SLUG`, and `PLANE_API_KEY`. Keys are
stored locally in `data/secrets.json` (gitignored). **Until you connect, the PMO Board runs on seeded
mock projects**; the Platform view needs your App URL to embed the real Plane workspace.

> Note: live work-item **state changes** need your instance's state UUIDs (per project), so those are
> finalized in a quick connect-time validation pass (there's a `/api/pm/diagnostics` probe for it).
> Reads and simple creates work immediately. Self-hosting Plane is a multi-service Docker stack
> (Postgres + Redis/Valkey + RabbitMQ + MinIO + app services); our app only needs the URL + key + slug.

## Marketing (TryPost) — social scheduling for the Marketing team

The **Marketing** page is powered by [**TryPost**](https://github.com/trypostit/trypost), the open-source
social-media scheduler (AI-copilot + MCP). It's where the content agents run the social calendar. Two views:

- **Platform** — **embeds the full TryPost app** (with an "Open in TryPost ↗" link; the hosted cloud may
  block iframing, in which case the link opens a new tab — a self-hosted TryPost embeds inline).
- **Calendar** — a state board (Draft → Scheduled → Published → Failed) built on the TryPost API, with
  create + advance (Schedule/Publish), reflecting what the agents do.

**Who can use it.** The **Social Media Strategist**, **Content Strategist**, and **Brand** agents carry the
`trypost` tool. (Research, AEO/SEO, and Email Marketing use other tools — social scheduling isn't their job.)

**What the agents can do** (each maps to a real TryPost API call):

| Tool | Action |
|---|---|
| `social_summary` | Channels + post counts by state + scheduled-next-7-days |
| `social_list_channels` | List connected social accounts |
| `social_list_posts` | List/filter posts by status or search |
| `social_create_post` | Draft, schedule, or publish a post |
| `social_update_post` | Edit copy, schedule, or publish a post |

When a **Marketing task** runs, the agent touches TryPost: e.g. *"Draft a LinkedIn post announcing the
Meridian case study"* → creates a draft; *"Schedule the launch tweet"* → schedules it. Changes appear on
the Marketing Calendar and in the task deliverable.

**Connect your workspace.** In **Settings → Connectors → Marketing**, set the **API base URL** (your
TryPost `APP_URL`; the API lives at `APP_URL/api`), the **App URL** (for the embed/link, usually the same),
and an **API key** (a workspace-scoped **Bearer** Personal Access Token). Or use env vars `TRYPOST_API_URL`
(default `https://app.trypost.it`), `TRYPOST_APP_URL`, and `TRYPOST_API_KEY`. Keys are stored locally in
`data/secrets.json` (gitignored). **Until you connect, the Marketing page runs on seeded mock posts.**
There's a `/api/social/diagnostics` probe to validate/tune the mappers once connected. TryPost self-hosts
as a lean Laravel stack (Postgres + Redis) — Railway-friendly; our app only needs the URL + key.

## Email (Mautic) — email marketing for the Email Marketing agent

The **Email** page is powered by [**Mautic**](https://github.com/mautic/mautic), the open-source marketing
automation platform — email campaigns, contacts, segments and drip journeys. It complements the social
scheduler (TryPost) by covering the email side the Email Marketing agent owns. Two views:

- **Platform** — **embeds the full Mautic app** (with "Open in Mautic ↗"; self-hosted Mautic that allows
  framing embeds inline, otherwise the link opens a new tab).
- **Board** — KPIs (emails, sent, open rate, contacts) + tabs for **Emails**, **Campaigns**, and
  **Contacts**, built on the Mautic API, with create + send.

**Who can use it.** Only the **Email Marketing** agent (`mk_news`) carries the `mautic` tool.

**What the agent can do** (each maps to a real Mautic API call):

| Tool | Action |
|---|---|
| `email_summary` | Email counts, total sent, avg open rate, campaigns, contacts |
| `email_list_emails` / `email_create_email` / `email_send` | List/draft emails; send to a segment |
| `email_list_campaigns` | Drip/automation campaigns |
| `email_list_segments` | Contact segments (lists) |
| `email_list_contacts` / `email_create_contact` | List / add contacts |

When an **Email Marketing task** runs, the agent touches Mautic: *"Draft a webinar invite email"* → creates
a draft; *"Send the September newsletter"* → sends it to its segment. Changes show on the Email Board.

**Connect your instance.** In **Settings → Connectors → Email**, set the **Base URL**, **App URL** (for the
embed), and **OAuth2 Client ID + Secret** (enable the API in Mautic → *Configuration → API Settings*, then
create API credentials; the agent uses the **`client_credentials`** grant — machine-to-machine, no user
login). Or use env vars `MAUTIC_API_URL`, `MAUTIC_APP_URL`, `MAUTIC_CLIENT_ID`, `MAUTIC_CLIENT_SECRET`
(Basic Auth via `MAUTIC_BASIC_USER` / `MAUTIC_BASIC_PASS` also works). Secrets are stored locally in
`data/secrets.json` (gitignored). **Until you connect, the Email page runs on seeded mock data.** There's
a `/api/email/diagnostics` probe for the connect-time validation.

> Note: Mautic uses **MySQL/MariaDB** (not Postgres) and self-hosts as a multi-container stack
> (web + cron + worker + MariaDB), so it brings its own database; our app only needs the URL + credentials.
> Mautic's collections come back as objects keyed by id — the client already handles that.

## First few minutes (the Office)

1. Open the **Office** (top-bar link). The bar shows **LIVE · CLAUDE** or **DEMO**.
2. In the sidebar, pick a department, type a task in plain words, press **Add**. The office picks
   the agent; the task appears in the feed and the agent's desk lights up while they work.
3. Type a schedule into the task box — `every weekday at 8am, triage the inbox` — and it becomes a
   **routine** with a countdown. Outbound-looking work (send, post, pay) waits for your **Approve**.
4. Click **The Brain** (or press **G**) to see your notes as a graph. Click a node to read it.
5. Press **1–6** to focus a department, **G** for the Brain, **Esc** to step back.

## Make it yours

`office.config.json`:

```json
{
  "name": "Orbit Prism Operating System",
  "studio": "Northwind Atelier",
  "brain": "./brain",
  "port": 43140,
  "model": "sonnet",
  "mcp": { "allow": [], "deny": [], "departments": {} },
  "tools": { "web": true }
}
```

- **studio** — your business. It appears in every agent's brief.
- **brain** — a folder of Markdown notes with `[[wiki links]]`. **An Obsidian vault works as is** —
  point this at your vault and the agents read your notes and skills. See [OBSIDIAN.md](OBSIDIAN.md).
  The sample `brain/` is a small fictional studio so the office works out of the box.
- **mcp.allow / deny / departments** — empty `allow` means every connected server; `deny` keeps a
  server in the bar but out of the agents' hands; `departments` wires a server to specific pods.
- Put private overrides in `office.config.local.json` (gitignored).

The 33 agents live in [`src/lib/office-data.ts`](src/lib/office-data.ts). Skills live in
[`skills/`](skills) as `SKILL.md` folders bound to an agent id or a department. `/api/skills`
lists who has what.

## How the pieces connect

```
Office UI ──▶ Next.js API ──▶ Office runtime ──┬─▶ claude -p        (live)
                                               ├─▶ Simulated work   (demo)
                                               ├─▶ Brain (markdown, [[links]])
                                               ├─▶ Skills (SKILL.md)
                                               └─▶ Routines clock
```

- **Claude** — `src/lib/server/claude.ts` detects the CLI and runs headless prompts. Agents never
  get Bash or unconstrained file tools; the runtime writes deliverables to the Brain itself.
- **MCP** — `src/lib/server/mcp.ts` parses `claude mcp list` and applies your allow/deny.
- **Brain** — `src/lib/server/brain.ts` reads notes, builds the `[[link]]` graph, retrieves the
  most relevant notes for each task, and files deliverables back.
- **Skills / Routines** — `src/lib/server/skills.ts` and `routines.ts` (`when.ts` parses cadences).

## Deploying

See [DEPLOY.md](DEPLOY.md). Short version: it runs great on your **Mac mini** for the full live
experience, and moves to **Railway** (a persistent container, not serverless) when you want a
shareable URL. It is **not** built for Vercel — serverless cannot run the Claude CLI or a
persistent routines clock.

## Where things live

| Path | What |
|---|---|
| `src/app/page.tsx` | Home — redirects to `/agents` |
| `src/app/login/page.tsx` | Login / register (space-station background) |
| `src/app/agents/` · `src/components/agents/` | The home: agent list + embedded 3D office + chat (per-agent model picker) |
| `src/app/vault/page.tsx` · `src/components/vault/` | The V.A.U.L.T 3D Brain (`Brain3D.tsx`, `VaultPage.tsx`) |
| `src/app/sales/page.tsx` · `src/components/crm/CrmBoard.tsx` | Sales deal-flow board (Twenty) |
| `src/lib/server/twenty.ts` | Twenty CRM client + mock store + agent CRM tools |
| `src/app/api/crm/` | Sales/CRM API: deals list/create, deal get/update, connection config |
| `src/app/finance/page.tsx` · `src/components/finance/FinanceBoard.tsx` | Finance books dashboard (Bigcapital) |
| `src/lib/server/bigcapital.ts` | Bigcapital client + mock books + agent finance tools |
| `src/app/api/finance/` | Finance API: books aggregate, invoice create/update, chart of accounts, connection config, diagnostics |
| `src/app/pmo/page.tsx` · `src/components/pmo/PmoBoard.tsx` | PMO page: embedded Plane platform + board |
| `src/lib/server/plane.ts` | Plane client + mock projects + agent PM tools |
| `src/app/api/pm/` | PM API: board aggregate, work-item create/update, connection config, diagnostics |
| `src/app/marketing/page.tsx` · `src/components/marketing/MarketingBoard.tsx` | Marketing page: embedded TryPost platform + calendar |
| `src/lib/server/trypost.ts` | TryPost client + mock posts + agent social tools |
| `src/app/api/social/` | Social API: board aggregate, post create/update, connection config, diagnostics |
| `src/app/email/page.tsx` · `src/components/email/EmailBoard.tsx` | Email page: embedded Mautic platform + board |
| `src/lib/server/mautic.ts` | Mautic client (OAuth2/basic) + mock emails + agent email tools |
| `src/app/api/email/` | Email API: board aggregate, email create/send, connection config, diagnostics |
| `src/lib/server/llm.ts` · `providers.ts` · `composio.ts` | Provider switch (Ollama local+Cloud / LM Studio / xAI / Claude / demo) + tool routing (CRM/Finance/PM/Social/Email) |
| `src/app/api/settings/connectors/` · `src/lib/server/claude.ts` | Add/remove MCP + CLI connectors (`claude mcp add/remove`) |
| `src/components/office/` | The 3D isometric scene: canvas, pods, desks, Brain (embedded on the Agents page) |
| `src/components/chrome/` | Brand wordmark, top nav, task panel, Brain graph, office overlay |
| `src/lib/server/` | Runtime, auth, Claude, MCP, Brain, skills, routines, vault config |
| `src/lib/brain-categories.ts` | 3D Brain categories + colors (adapted from AIS-OS) |
| `src/app/api/` | Office, tasks, jarvis, hive, agents, brain, brain-3d, brain-file, vault, auth |
| `src/lib/office-data.ts` | Departments, the 33 agents, and Jarvis (Chief of Staff) |
| `brain/` | The sample Brain (Markdown notes + sample attachments) |
| `skills/` | Sample skills |
| `office.config.json` | Your office settings (incl. Obsidian `vaultId` / `brain` path) |

## Credits

- The **3D Brain** in the Vault is adapted from **[AIS-OS](https://github.com/nateherkai/AIS-OS)**
  by Nate Herk (MIT License, © 2026 Nate Herk) — its `/3d-brain` concept, category palette, and
  interactions (search, note reading, Cinema, growth replay) were re-implemented natively here.

## License

MIT — see [LICENSE](LICENSE). This project is your own to use and change.
