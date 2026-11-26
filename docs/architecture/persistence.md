# Persistence and partial writes

Proposed: Forge SQL relational records with `@forge/sql`, KVS secret store for credential material. No ORM or persistence implementation in Sprint 0. Official capability references and date: [assessment](../project/forge-capability-assessment.md), verified 2026-11-24.

The SDK documentation establishes individual parameterised statements, not an application-managed multi-statement transaction/session API. Do not issue BEGIN/COMMIT across API calls or rely on shared connections, lock persistence, SQL foreign keys or cascade deletes. Use supported PK/unique indexes and single-statement conditional updates. Verify affectedRows and query-policy compatibility on a registered development installation in Sprint 1.

Each mutable aggregate has `version`; update using tenant + ID + expected version and increment on success. Event receipt is a single unique insert keyed by the idempotency digest with normalised payload/reference and next processing state in the same row. Workers use a conditional state/version/lease claim; lease expiry alone does not resolve an ambiguous Jira write. A sweeper recovers stale claims only after checking external side effects.

A durable inbox row carries enqueue state. Insert first, enqueue its ID, then mark enqueued. If push or marking fails, a bounded sweep retries dispatch; duplicate dispatch is safe because the worker rechecks state. Store each integration intent and reconciliation marker before sending. Result/mapping/audit writes may fail independently; replay fills missing records using unique keys. Commit processing completion only after required state is durable; audit gaps are repaired from versioned aggregate state, not hidden.

Migrations use immutable named migrationRunner operations in one invocation per installation, preferably an async consumer. Track schema readiness before accepting tenant data. Expand/backfill/contract changes are resumable, paginated and version compatible. Never run destructive migrations during ordinary reads. DDL retries, concurrent install/upgrade, development quotas and fixture cleanup need live tests; migration implementation belongs to Sprint 1.

Retention uses bounded tenant-indexed pages and application reference checks; no cascades exist. Soft-disable parent records first, prevent new children, sweep dependencies and only then delete eligible tombstones. Recovery and SLA histories must survive policy edits. Reconcile SQL → queue → JSM independently; no distributed atomicity is claimed.

## Workflow preparation (Sprint 0.5 design)

The entity decision table in data-model.md is the migration scope authority. Sprint 1 implements inventory/tenancy only, with CustomerService and uplink ServiceDependency replacing the ambiguous service ID. Incident conditional updates will carry one active handoff pointer and bounded pending command/audit envelope; audit/validation/handoff materialisation is idempotent and gates further mutation until repaired. No multi-table transaction or partial unique index is assumed. Later forward migrations add operational records only in their assigned sprints. No schema or persistence SDK is added in Sprint 0.5.

## Sprint 1 implementation — 2026-11-26

Forge SQL 4.0.11 implements repository ports through prepare/bindParams. DML responses read rows.affectedRows; conditional writes require exactly one affected row and always change an intent or increment version. Unexpected shapes fail closed. Recognised native ER_DUP_ENTRY errors become CONFLICT; unknown SDK errors are sanitised. Runtime verification of the exact native error/affected-row shapes remains mandatory.

The fifteen immutable v001 DDL operations are pinned by a contract hash/order test. A development-admin action queues one async schema job; concurrency key light-house-schema-v1 has limit one per installation. The worker creates readiness metadata, marks provisioning, runs the single migrationRunner, checks all checkpoints, then marks ready. Failures mark failed when possible and never enable writes; at most three executions per queued job occur. Retry is explicit after exhaustion. Reads do not issue DDL. There is no automatic production migration or uninstall cleanup.

A complete bounded tenant intent is admitted before inventory writes to prevent relationship creation/retirement write skew. Reference checks run under this durable admission; aggregate pending intents and uniquely keyed receipts make partial target/receipt/clear failures replayable. Configure-tenant changes clear the matching intent in the same conditional statement. Other writes clear it only after target intent/receipt materialisation. Repair is explicit and administrator-authorised. It is an application state machine, not a transaction, shared SQL session or persistent database lock. The development-only synthetic repair probe intentionally stops after the target write to exercise actual persistence during later live acceptance.

The local SQLite simulation rewrites DDL/upsert syntax and executes actual repository queries. Mock SDK tests verify wiring and result handling. Neither proves TiDB syntax/collation/query-policy, Forge migration retries/concurrency, platform cost or installation separation. See [live procedure](../operations/sprint-1-live-acceptance.md) and [ADR-0016](../adr/ADR-0016-sprint-1-persistence-and-repair.md).
