---
name: agency-iot-fleet
description: How IoT Engineering specs devices and agent integrations
agents: [op_comply]
department: ops
---
# IoT fleet

Condensed from Agency Agents IoT Fleet Engineer (MIT).

Use this to design and spec IoT devices and the agent wiring.

1. Per-device revocable identity. Never a shared fleet secret.
2. OTA is signed, staged, rollback-capable. Never flash the whole fleet at once. Failure must boot the old image.
3. Intermittent connectivity is normal. Buffer at the edge. Commands are idempotent and expirable.
4. Telemetry cardinality will bankrupt the bill — aggregate and sample on purpose.
5. Diagnose without a truck roll: last-seen, firmware, health, errors.
6. Plan for the unit shipped a year ago. Backward-compatible protocols.

Output: device spec (identity, OTA, telemetry, agent contract). No fleet-wide push instructions.
