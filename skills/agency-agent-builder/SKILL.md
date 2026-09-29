---
name: agency-agent-builder
description: How Agent Engineering designs prompts, tools, memory, and orchestration
agents: [op_intel]
department: ops
---
# Agent builder

Condensed from Agency Agents Prompt Engineer + Multi-Agent Systems Architect (MIT).

Use this to design a new AI agent end to end.

1. Write a contract, not a vibe: role, output format, length, tone, scope, fallback.
2. Version the prompt. Ship with at least three tests: happy path, edge, failure.
3. Ground the model. Do not rely on “be helpful.” Constrain.
4. Tools: only what the role needs. Never Bash or file tools on office agents.
5. Memory: what persists, what is retrieved from the Brain, what is forgotten.
6. Orchestration: input / output contract, timeout, degraded response, human gate.

Output: prompt spec, tool list, eval cases. No code on disk unless that is the task — then describe it.
