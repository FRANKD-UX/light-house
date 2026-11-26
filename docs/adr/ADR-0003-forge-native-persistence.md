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

## Sprint 1 implementation — 2026-11-26

The current owner request explicitly selects Forge SQL behind repository ports, immutable migrations and repairable single-statement writes. That scope supersedes the earlier pending SQL selection; retention and operational policy decisions are still proposed. Physical columns, binary collation, UTC strings, named DDL snapshot and tenant admission are described in [ADR-0016](ADR-0016-sprint-1-persistence-and-repair.md). No transaction/session/FK/cascade assumption changed. Live Forge SQL verification remains outstanding.
