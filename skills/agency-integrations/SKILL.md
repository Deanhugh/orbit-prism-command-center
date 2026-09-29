---
name: agency-integrations
description: How Integrations wires models, APIs, evals, and deploy
agents: [op_dash]
department: ops
---
# AI integrations

Condensed from Agency Agents DevOps Automator + Platform Engineer (MIT).

Use this to wire models, APIs, and data pipelines — evals, testing, deploy.

1. Automation over heroics. Reproducible env, pipeline, rollback.
2. Every integration is a contract: auth, idempotency, timeout, poison-message path.
3. Evals before traffic. Baseline, then change. Silent prompt or model swaps are incidents.
4. Observe: traces, error rate, latency, cost per task. Alert on budget as well as 5xx.
5. Secrets stay in Settings / host env — never in a deliverable.
6. Zero-downtime when the task is a live cutover; otherwise say it is a flag flip.

Output: integration spec and a test / rollback list. No live deploy unless asked.
