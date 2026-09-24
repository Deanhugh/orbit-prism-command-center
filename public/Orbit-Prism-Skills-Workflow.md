# Orbit Prism — Adding Skills & Notes via Obsidian

**The recommended workflow for teaching your agents.**
This guide covers connecting your Obsidian vault, adding skills, and adding brain notes so every
agent has what it needs to do its job.

---

## 0. The idea in one line

Your **Obsidian vault is the Brain**. Agents read your **notes** (context) and **skills**
(step-by-step how-to) before every task. Add or edit either in Obsidian and it takes effect on the
next task — no restart.

- **Note** = knowledge (pricing, clients, brand voice, SOPs).
- **Skill** = how a *kind of work* is done, step by step, bound to specific agents.
- **Brief** = a couple of standing sentences about one agent (who/tone) — lives in the roster.

---

## 1. One-time setup

1. Make sure `office.config.json` points at your vault (already done for you):
   ```json
   {
     "vaultId": "e11eb5f056363b9d",
     "brain": "/Users/howardvernon/Main/Obsidian/Orbit Prism"
   }
   ```
   The app finds the vault by its Obsidian **vault ID** first, then the **path**, then falls back
   to the bundled sample so nothing ever breaks.

2. Start the office **on the machine that has the vault** (your Mac mini):
   ```bash
   npm install
   npm run seed:vault      # optional: copies the 3 sample skills into <vault>/skills/
   npm run dev             # → http://localhost:43140
   ```

3. Confirm it's connected: the **"The Brain"** card in the right sidebar shows a **green dot**
   plus your real note and skill counts. (Amber dot = it fell back to the sample brain — see
   Troubleshooting.)

---

## 2. Where skills live

Create a `skills/` folder inside your vault:

```
<your vault>/skills/
```

A skill is either:
- **A single note** — `skills/Proposals.md` with front matter (easiest in Obsidian), **or**
- **A folder** — `skills/proposal/SKILL.md` (use this when you want a `template.md` beside it).

---

## 3. Create a skill in Obsidian (step by step)

1. In Obsidian, make a new note inside `skills/`, e.g. **`Proposals.md`**.
2. Add **properties** (front matter). Click the properties area at the top of the note, or press
   **Cmd + ;** (Mac). Add:
   - `name` — a short id, e.g. `proposal`
   - `description` — one line describing it
   - `agents` — a list of agent IDs (see the table below), e.g. `sl_proposals`
   - *(optional)* `department` — e.g. `sales`, to give it to a whole department
3. Write the actual instructions in the **note body**: the steps, the rules, the shape of a good
   result. Use `[[wiki links]]` to point at notes (e.g. `[[Pricing]]`) — agents follow them.
4. **Save.** It's live on the next task.

**Example** (`skills/Proposals.md`):

```markdown
---
name: proposal
description: How we write a client proposal
agents:
  - sl_proposals
department: sales
---
# Writing a proposal
1. Prices come from [[Pricing]]. Never invent one.
2. Present three options; recommend the middle one.
3. Write in [[Brand Voice]] — plain, warm, specific.
4. Close with one clear next step and a date.
```

> Obsidian's Properties panel writes YAML lists across multiple lines (as shown above). That is
> fully supported, as is the inline form `agents: [sl_proposals]`.

---

## 4. Binding: who gets the skill

Put these in the front matter:

| You want… | Use |
|---|---|
| One or more specific agents | `agents: [sl_proposals, sl_followup]` |
| Everyone in a department | `department: sales` |
| **Every agent** (house style, tone, glossary) | `agents: [all]` **or** `department: all` |

---

## 5. Agent IDs

Use these in a skill's `agents:` list. (Live copy at `http://localhost:43140/api/roster`.)

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

---

## 6. Adding brain notes (context)

Any `.md` note anywhere in the vault is readable. For each task, the office scores your notes
against the task and feeds the most relevant ones to the agent. Good starter notes:

- `About <your studio>.md` — who you are, your promise.
- `Ideal Client.md`, `Offer Ladder.md`, `Pricing.md` — the facts agents must not invent.
- `Brand Voice.md`, `Quality Bar.md` — how things should read and what "done" means.
- `Clients.md` — current engagements.

Link them with `[[wiki links]]`; press **G** in the app to see the graph. Deliverables the agents
produce are written back into `<vault>/Orbit Prism Operating System/`.

---

## 7. Verify & iterate

- **Sidebar "The Brain" card** — shows live note & skill counts, green dot when connected.
- **`/api/skills`** — lists every loaded skill and who has it.
- **Live reload** — edits in Obsidian apply on the **next task**; only `office.config.json`
  changes need a restart.

---

## 8. Best practices

- **Brief = who/tone; Skill = how, step by step.** Keep them separate.
- Bind narrow skills to specific agents; put shared house rules on `all`.
- Point at facts with `[[links]]` (e.g. `[[Pricing]]`) instead of hard-coding numbers.
- Keep each skill focused on one kind of work. Several small skills beat one giant one.
- Say what **not** to do ("never invent a price", "never send without approval").

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| Brain dot is **amber** | The vault wasn't found on this machine. Open the vault in Obsidian once, check the `vaultId`/`brain` path, and confirm you're running on the Mac that has it. |
| Skill shows but **no agents** | Check the `agents:` IDs match the table above (they're case-insensitive). |
| Skill **not appearing** | It must be in a `skills/` folder in the vault, and a loose `.md` must start with `---` front matter. |
| Numbers look invented | Add the fact as a note and reference it from the skill with `[[links]]`; add a "never invent" rule. |

---

*Orbit Prism Operating System — your office, your notes, your rules.*
