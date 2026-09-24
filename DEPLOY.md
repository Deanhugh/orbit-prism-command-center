# Deploying Orbit Prism Operating System

Orbit Prism runs as a **persistent Node server**. Railway is the cloud host. The Mac mini is still
the home for local Ollama and the Claude Code CLI.

GitHub: https://github.com/Deanhugh/orbit-prism-command-center

## Phase 1 — Your Mac mini (full local features)

```bash
git clone https://github.com/Deanhugh/orbit-prism-command-center.git orbit-prism
cd orbit-prism
npm install
npm run build
npm start                         # → http://localhost:43140
```

Keep it running so routines fire on schedule (`pm2` or `launchd`). Local Ollama at
`http://127.0.0.1:11434/v1` and a logged-in `claude` CLI both work here.

## Phase 2 — Railway (public URL)

1. Push `main` to https://github.com/Deanhugh/orbit-prism-command-center
2. In Railway: **New Project → Deploy from GitHub repo** → pick that repo.
3. Railway builds from [`Dockerfile`](Dockerfile) (`railway.json` selects it).
4. Add two **Volumes**:
   - `/app/data` — logins, Settings, agent config, session secret
   - `/app/brain` — notes and routine state
5. Set environment variables (Railway sets `PORT` itself):

   | Variable | Required | Purpose |
   |---|---|---|
   | `ORBIT_SECRET` | yes | Signs login cookies. Generate a long random string and keep it. |
   | `DATA_DIR` | no | Defaults to `/app/data` in the image. |
   | `ORBIT_BRAIN` | no | Defaults to `./brain` if unset. |
   | `OLLAMA_API_KEY` | for Ollama Cloud | Pair with base URL `https://ollama.com/v1` in Settings. |
   | `OLLAMA_BASE_URL` | for a tunneled Mac Ollama | Example: `https://your-tunnel/v1` — not `127.0.0.1`. |
   | `OPENAI_API_KEY` | for ChatGPT | |
   | `XAI_API_KEY` | for Grok | |
   | `OPENROUTER_API_KEY` | optional | Claude / GPT / Grok through one key. |
   | `COMPOSIO_API_KEY` | optional | Extra SaaS connectors. |
   | `ORBIT_MODE=demo` | no | Only if you want simulated agent work. Leave unset for live providers. |

6. Deploy. Every push to the connected branch redeploys.

### Cloud constraints

- Railway **cannot** reach `http://127.0.0.1:11434` on your Mac. Use Ollama Cloud, or expose Ollama
  with Tailscale / a tunnel and set that URL.
- The **Claude Code CLI** is not on Railway. Cloud Claude needs an Anthropic or OpenRouter key
  (that HTTP path is a follow-up if you want it).
- Do not host this on Vercel. Serverless cannot keep the process or the volumes.

## First login on Railway

Open the Railway URL → lock screen. The first visit sets the machine password (6+ characters) as
user `operator`, unless you already created an account in Settings.
