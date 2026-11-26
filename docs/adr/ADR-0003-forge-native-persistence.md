# ADR-0003: Forge-native persistence

Date: 2026-11-24

Status: Proposed — implementation default pending owner review

## Context

Inventory, policy history and incident processing need relational access and secrets.

## Decision

Use Forge SQL for relational data and KVS secrets for credential material; no general ORM. Model each write as an independent statement with repairable state.

## Rationale

Installation-scoped storage is documented; avoids AWS and another database host.

## Consequences

No FK/cascades or established multi-statement transaction API. Quotas, schema migration readiness, tenant predicates and partial-write repair become app responsibilities.

## Alternatives considered

KVS-only inventory was considered but does not fit relational access; external databases excluded.

## Verification requirements

Sprint 1 must verify migrationRunner, composite uniqueness, affectedRows/conditional update concurrency, bind parameters and query-policy limits on a real installation.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/storage-reference/sql/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.

## Sprint 0.5 refinement — 2026-11-25

Proposed minimal operational representation is in data-model.md: dedicated handoff/validation/impact records later, existing incident SLA snapshot/audit history reused, fixed workflow/checklists in code. Sprint 1 stays inventory/tenancy only. No generic engine or complete future schema is authorised by this design.
