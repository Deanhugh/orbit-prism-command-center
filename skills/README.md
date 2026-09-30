# Skills

Each skill is a playbook the Command Center injects into an agent’s system prompt. It is **not** an Ollama model.

```
skills/<slug>/SKILL.md
```

This folder is the GitHub source of truth. After you push to `main` and Railway finishes deploying,
every `skills/<name>/SKILL.md` here shows on **Settings → Skills** with a **GitHub** badge:

https://app.orbitprism.com/jarvis/settings?tab=skills

You can also drop a `SKILL.md` on that Settings page. Uploads apply immediately and persist on the
host; they do not write back to this repo. Add the same file here if you want it versioned.

Live work injects about 1,200 characters of each bound skill body; chat injects about 1,000 (1,600
when a skill is picked). Keep playbooks short.

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
- `agents` — agent ids from the office (`jarvis` / `chief` for the Chief of Staff), or `all`
- `department` — grouping on Settings. When `agents` is set, only those desks receive the playbook.

## Office playbooks

Checked-in originals: `inbox-triage`, `client-report`, `proposal`, `chief-of-staff`.

## Agency desk playbooks

The 33 `agency-*` folders are condensed from [Agency Agents](https://github.com/msitarzewski/agency-agents)
(MIT). Same desks (`id` / `dept` / `seat` unchanged). Better playbooks. They are **not** new
agents and they do **not** grant Write, Edit, Read, or Bash.

| Skill | Desk | Agency sources |
| --- | --- | --- |
| `agency-market-research` | Research (`mk_research`) | Trend Researcher, Research Synthesist |
| `agency-aeo-seo` | AEO / SEO (`mk_ads`) | SEO Specialist, AI Citation Strategist |
| `agency-brand-guardian` | Brand (`mk_gfx`) | Brand Guardian |
| `agency-content-strategy` | Content Strategist (`mk_lead`) | Content Creator |
| `agency-email-lifecycle` | Email Marketing (`mk_news`) | Email Marketing Strategist |
| `agency-social-strategy` | Social (`mk_social`) | Social Media Strategist |
| `agency-portfolio-producer` | Program Manager (`em_lead`) | Studio Producer |
| `agency-project-shepherd` | Project Manager (`em_client`) | Project Shepherd |
| `agency-studio-operations` | Project Manager (`em_internal`) | Studio Operations |
| `agency-risk-scope` | Project Manager (`em_vendor`) | Senior Project Manager |
| `agency-capacity-planning` | Project Manager (`em_partner`) | Sprint Prioritizer |
| `agency-account-lead` | Head of Account Management (`dl_lead`) | Customer Success Manager |
| `agency-client-onboard` | Account Manager (`dl_coord`) | CSM onboarding |
| `agency-account-health` | Account Manager (`dl_qa`) | CSM health |
| `agency-client-outcomes` | Account Manager (`dl_reports`) | Analytics Reporter |
| `agency-renewals` | Account Manager (`dl_assets`) | CSM renewals |
| `agency-account-expand` | Account Manager (`dl_design`) | Account Strategist |
| `agency-key-accounts` | Account Manager (`dl_onboard`) | CSM relationship |
| `agency-deal-strategy` | Sales Lead (`sl_lead`) | Deal Strategist, Pipeline Analyst |
| `agency-lead-enrichment` | Enrichment (`sl_enrich`) | Sales Data Extraction (adapted) |
| `agency-inbound-discovery` | Inbound (`sl_inbound`) | Discovery Coach |
| `agency-outbound-signals` | Outbound (`sl_prospect`) | Outbound Strategist |
| `agency-proposal-narrative` | Proposals (`sl_proposals`) | Proposal Strategist |
| `agency-pipeline-revival` | Follow ups (`sl_followup`) | Sales Outreach follow-up |
| `agency-ai-engineering` | Engineering Lead (`op_lead`) | AI Engineer, Multi-Agent Architect |
| `agency-agent-builder` | Agent Builder (`op_intel`) | Prompt Engineer, Multi-Agent Architect |
| `agency-command-center` | Command Center Eng (`op_legal`) | Platform Engineer, Multi-Agent Architect |
| `agency-iot-fleet` | IoT Engineer (`op_comply`) | IoT Fleet Engineer |
| `agency-integrations` | AI Integrations (`op_dash`) | DevOps Automator, Platform Engineer |
| `agency-finance-lead` | Comptroller (`fn_lead`) | CFO, Bookkeeper & Controller |
| `agency-invoicing` | Invoicing (`fn_invoice`) | Bookkeeper AR |
| `agency-payables` | Payables (`fn_payable`) | Accounts Payable Agent |
| `agency-reconciliation` | Reconciliation (`fn_recon`) | Bookkeeper reconciliation |
