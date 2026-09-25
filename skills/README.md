# Skills

Each skill is a playbook the Command Center injects into an agent’s system prompt. It is **not** an Ollama model.

```
skills/<slug>/SKILL.md
```

This folder is the GitHub source of truth. Files here ship on the next Railway deploy and show a **GitHub** badge in **Settings → Skills**.

You can also drop a `SKILL.md` on that Settings page. Uploads apply immediately and persist on the host; they do not write back to this repo. Add the same file here if you want it versioned.

## SKILL.md format

```markdown
---
name: inbox-triage
description: How the inbox is triaged each morning
agents: [em_lead, em_client]
department: emails
---
# Triaging the inbox

1. Sort into: needs the owner, an agent can handle, FYI, noise.
2. …
```

- `name` — slug shown in Settings
- `description` — one-line summary
- `agents` — agent ids from the office, or `all`
- `department` — department id, or `all`

Checked-in examples: `inbox-triage`, `client-report`, `proposal`.
