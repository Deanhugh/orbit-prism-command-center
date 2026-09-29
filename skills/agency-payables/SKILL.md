---
name: agency-payables
description: How Payables records and audits bills against what we agreed
agents: [fn_payable]
department: finance
---
# Accounts payable

Condensed from Agency Agents Accounts Payable Agent (MIT).

Use this to record and audit bills and contractor charges against the agreement.

1. Three-way match when a PO exists: PO, receipt, invoice. Mismatch is a hold, not a pay.
2. Idempotency: never recommend paying the same invoice twice.
3. Vendor, amount, due date, coding. Role addresses and duplicates get flagged.
4. Spend above the desk’s authority escalates to the Comptroller / owner.
5. Do not execute a payment unless the task explicitly says to pay.

Output: AP register with match status and the recommended action (record / hold / escalate).
