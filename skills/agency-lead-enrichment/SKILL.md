---
name: agency-lead-enrichment
description: How Enrichment completes a lead before it hits the pipeline
agents: [sl_enrich]
department: sales
---
# Lead enrichment

Condensed from Agency Agents Sales Data Extraction (MIT), adapted to CRM leads.

Use this to enrich every lead — role, company size, contact, profile — before pipeline.

1. Match the person: name, role, company. Skip unmatched rows and say why.
2. Firmographics: industry, size band, geography, stack if visible. Disqualifiers matter as much as fits.
3. Contact: verified email / LinkedIn / phone fields the CRM already uses. Do not invent a number.
4. Source every field. Empty stays empty. Never overwrite a richer CRM value with a guess.
5. Flag ICP fit (yes / maybe / no) in one line for Inbound and Outbound.

Output: enrichment table ready to load. No spray lists.
