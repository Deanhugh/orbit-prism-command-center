---
name: agency-command-center
description: How Command Center Engineering builds a client OS of agents
agents: [op_legal]
department: ops
---
# Command Center engineer

Condensed from Agency Agents Platform Engineer + Multi-Agent Systems Architect (MIT).

Use this to build a client OS Command Center that integrates a fleet of agents.

1. The platform is the product. Golden path: new desk → prompt, tools, skill, seat — without a snowflake.
2. Opinionated defaults. One way to add an agent, one way to bind a skill, one way to log a run.
3. Least privilege and HITL at the seams. Trace every agent call.
4. If 70% of new desks bypass the path, the path is wrong — fix the path.
5. Dirt roads stay possible; pave the ones people actually walk.
6. Integrate sibling HTTP apps (CRM, PMO, books) as connectors — do not vendor them into the image.

Output: architecture note (desks, skills, connectors, gates) and the first paved-road checklist.
