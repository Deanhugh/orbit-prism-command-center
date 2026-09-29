# Using your Obsidian vault as the Brain

Orbit Prism's **Brain is just a folder of Markdown notes with `[[wiki links]]`** — which is
exactly what an Obsidian vault is. So your "OrbitPrism" vault can be the backend brain with no
conversion. Agents read the most relevant notes before every task, and their skills can live in
the vault too.

## 1. Point the office at your vault

You can do this two ways.

**Option A — by Obsidian vault ID (recommended).** Obsidian gives each vault a 16-character ID.
Set it as `vaultId` and the office resolves the folder automatically from Obsidian's registry on
the machine that runs it:

```json
{
  "name": "Orbit Prism Operating System",
  "studio": "Your Studio Name",
  "vaultId": "e11eb5f056363b9d",
  "brain": "./brain",
  "port": 43140
}
```

(`vaultId` is already set to your Orbit Prism vault. `brain` stays as a fallback for machines that
don't have that vault, e.g. a cloud host.)

**Option B — by absolute path.** If you prefer, leave `vaultId` empty and set `brain` to the
vault's folder path, e.g. `"brain": "/Users/you/Documents/OrbitPrism"`.

Restart the office (`npm run dev` or `npm start`). The "The Brain" card in the sidebar shows the
live **note and skill counts** and a **green dot when the Obsidian vault is connected** (amber if
it fell back to the sample brain because the vault wasn't found on this machine).

> The vault ID resolves only on the machine where that Obsidian vault exists (your Mac mini). On a
> different machine it safely falls back to the `brain` path.

> Notes and skills are re-read on every task, so **adding or editing notes in Obsidian takes
> effect immediately** — no restart needed. Only `office.config.json` changes need a restart.

## 2. Notes (what the agents read)

- Any `.md` file anywhere in the vault is a note. `[[wiki links]]` become edges in the Brain
  graph (press **G**).
- For each task, the office scores your notes against the task text and feeds the top few to the
  agent, plus the agent's brief and any matching skills.
- Deliverables the agents produce are written back into the vault under
  `Orbit Prism Operating System/` as dated notes that link to what they read — so your graph
  grows as the office works. (Add that folder to your Obsidian `.gitignore`/sync as you like.)

## 3. Skills (how a kind of work is done)

Put skills in your vault in any of these folders (create whichever you prefer):

```
<vault>/skills/
<vault>/OrbitPrism/skills/
<vault>/Orbit Prism Operating System/skills/
```

A skill is either a **folder with a `SKILL.md`**, or a **single `.md` note with front matter**.
Both work — the single-note form is the most Obsidian-friendly:

```markdown
---
name: proposal
description: How we write a client proposal
agents: [sl_proposals]
department: sales
---
# Writing a proposal
1. Prices come from [[Pricing]]. Never invent one.
2. Present three options; recommend the middle one.
3. Write in [[Brand Voice]].
```

Binding options in the front matter:

- `agents: [id, id]` — give the skill to specific agents (IDs below).
- `department: sales` — give it to every agent in that department.
- `agents: [all]` or `department: all` — give it to **every agent** (useful for house style, tone,
  or a company glossary every agent should know).

`/api/skills` (and the sidebar's "The Brain" count) shows which skills loaded and who has them.

### Seed the sample skills into your vault

To start from the three sample skills, run this **on the machine that has the vault**:

```bash
npm run seed:vault          # copies skills/* into <vault>/skills/ (skips existing)
npm run seed:vault -- --force   # overwrite existing copies
```

It resolves your vault by `vaultId` (or the `brain` path), copies `client-report`, `inbox-triage`
and `proposal` into `<vault>/skills/`, and never touches the bundled sample brain. Edit them in
Obsidian afterwards; the office re-reads skills on the next task.

## 4. Agent IDs (for skill binding)

Use these IDs in a skill's `agents:` list. You can also fetch this live at `/api/roster`.

| Department | Agent | ID |
|---|---|---|
| Marketing | Campaign Lead | `mk_lead` |
| Marketing | Market Research | `mk_research` |
| Marketing | Newsletter | `mk_news` |
| Marketing | Graphics | `mk_gfx` |
| Marketing | Paid Ads | `mk_ads` |
| Marketing | Social Organic | `mk_social` |
| Emails | Inbox Lead | `em_lead` |
| Emails | Client Emails | `em_client` |
| Emails | Internal Emails | `em_internal` |
| Emails | Vendor Emails | `em_vendor` |
| Emails | Partner Emails | `em_partner` |
| Delivery | Delivery Lead | `dl_lead` |
| Delivery | Project Co-ord | `dl_coord` |
| Delivery | Quality Check | `dl_qa` |
| Delivery | Client Reports | `dl_reports` |
| Delivery | Client Assets | `dl_assets` |
| Delivery | Design Assist | `dl_design` |
| Delivery | Onboarder | `dl_onboard` |
| Sales | Sales Lead | `sl_lead` |
| Sales | Lead Enricher | `sl_enrich` |
| Sales | Inbound Manager | `sl_inbound` |
| Sales | Prospector | `sl_prospect` |
| Sales | Proposals | `sl_proposals` |
| Sales | Follow Ups | `sl_followup` |
| Operations | Operations Lead | `op_lead` |
| Operations | Intel | `op_intel` |
| Operations | Agreements | `op_legal` |
| Operations | Compliance | `op_comply` |
| Operations | Dashboards | `op_dash` |
| Finance | Accounting Lead | `fn_lead` |
| Finance | Invoicing | `fn_invoice` |
| Finance | Payables | `fn_payable` |
| Finance | Reconciliation | `fn_recon` |

## 5. Where this runs

**Mac (editor).** Keep Obsidian on the Mac. The vault stays at
`/Users/howardvernon/Main/Obsidian/Orbit Prism`. `vaultId` `e11eb5f056363b9d` in
`office.config.json` still attaches the Mac office to that vault. Do not install
Obsidian.app on Railway.

**Railway (agents).** The Command Center volume is mounted at `/app/data`. Point
`ORBIT_BRAIN` at `/app/data/brain` (not `/app/brain`). The office reads Markdown
from that folder. If the folder is empty on first boot it is seeded from the
bundled sample notes so Vault is never blank.

Sync the Mac vault onto the volume when you want Railway to see your real notes:

```bash
# On the Mac, after you have `railway` CLI linked to command-center
rsync -av --exclude '.obsidian' --exclude '.trash' \
  "/Users/howardvernon/Main/Obsidian/Orbit Prism/" \
  ./orbit-prism-brain/
# then copy that folder onto the /app/data/brain volume (Railway dashboard
# file browser, `railway ssh`, or a one-shot scp into the mount).
```

Obsidian Sync / git / a copy job all work. The agents only need the `.md` files
and `[[wiki links]]`.

## What I need from you to finish wiring it

1. Keep editing in Obsidian on the Mac.
2. After you sync the vault into `/app/data/brain`, open Vault — note count
   should rise above the 10 sample notes, `vaultId` stays as-is, `vaultConnected`
   stays false on Railway (expected — no Obsidian desktop there).
