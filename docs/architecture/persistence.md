# Persistence and partial writes

## Current implementation status — 2026-11-28

Local v003 incidents/evidence/policies, v004 JSM configuration/creation intents and v005 operational command/checklist/receipt/history persistence are implemented and tested with adapted SQLite. The serial incident migration consumer currently includes v003–v005; all are undeployed/unapplied here. Additive v006 native-transition registry/intents and migration helper are unregistered local work; no read migration or destructive earlier-DDL change. Current-state summary reads are bounded, installation/tenant-scoped and omit raw envelopes/actors. Independent transition intents persist one-send/bounded-reconcile uncertainty; they are not causal native confirmation. Existing DEVELOPMENT v1/v2 evidence must be verified separately and cannot be inferred from local tests.

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

## Read-only readiness investigation — 2026-11-26

The prepared development schema diagnostic reuses the inventory resolver before tenant/readiness lookup, so a confirmed Jira global administrator can investigate an unready installation. Runtime context fixes both bound query keys. The infrastructure reader invokes only migrationRunner.list() and SELECT readiness, schema_version with installation/environment predicates. Known checkpoint names are compared as a complete set; unknown names are counted but redacted. Missing names and readiness presence are null on read failure, never fabricated as empty/absent. Readiness value and schema version/type are projected separately; no coercion changes the production readiness predicate. No readiness writes or automatic remediation. Public contract contains names/enums only, never DDL/backend imports. Existing scoped application operations remain unchanged. See [procedure and deployment gate](../operations/sprint-1-live-acceptance.md).

## Native evidence update — 2026-11-26

Owner-run native DEVELOPMENT tunnel diagnostic confirms the complete fifteen-name registry set, no missing/unexpected names, null migration/readiness SQL error codes and a present ready/numeric-v1 metadata record. This accepts current checkpoint/readiness evaluation only. Native rerun/retry/concurrency, affectedRows/error-shape, inventory persistence/repair and second-installation evidence remain open. Current HTTP 400 historical cause is unverified. Establish the existing Lantern Fibre state read-only before further writes; seed can repair tenant intent and bootstrap can update a membership, so neither is an inspection tool.

## Native hosted inventory investigation — 2026-11-26

Named migrations/readiness and hosted health accepted separately. List binds tenant/cursor/limit, orders by ID and overfetches one row. Membership/list failures share the sanitised outer catch; originating native exception unavailable. Seed offset is local React state, not a durable checkpoint; first batch contains two carriers/two tiers and no sites. No persistence design, DDL or runtime correction changed; no new ADR decision. See [investigation](../operations/sprint-1-inventory-investigation.md).

Bounded inventory lifecycle telemetry now distinguishes readiness SQL, membership (including installation/lifecycle/expiry predicates), role authorisation, inventory SQL, row mapping, response construction and serialization. Query shapes and parameter bindings, including LIMIT ?, remain unchanged pending native evidence. No new reads/writes, migration, permission or egress. See operations/sprint-1-inventory-investigation.md for documented versus observed pagination support.

## Bounded inventory list SQL — 2026-11-26

Shared list change validates repository fetch limit as unknown number/safe integer 1–51, then renders only its bounded decimal integer. Tenant and cursor remain separately bound in that order; keyset predicate/order/lookahead/lifecycle semantics and diagnostics persist. No schema/migration/other-query change. This is a conditional compatibility correction, not a proven Forge LIMIT-placeholder prohibition. The generic test diagnostic contract is corrected without production interface changes; all 148 tests and local validation pass. Hosted acceptance remains separate; see the latest investigation/audit for deployment and runtime evidence.

## Local monitoring proposal — 2026-11-27

Additive migrations.v002.json defines monitoring schema state, sources, credential references, resource mappings and durable inbox. It does not alter immutable v001. Secret material remains behind the KVS-secret port; SQL contains references only. Local checkpoint helper preserves completed v002 DDL and inventory-ready-v1, with separate monitoring readiness. No deployed migration entrypoint or concurrency authority exists yet. See ADR-0018 and Sprint2 report; SQLite adaptation does not establish Forge SQL compatibility.

## Current v002 local implementation — 2026-11-27

Six-table registry now includes safe authenticated monitoring_observations and inbox first correlation/atomic duplicate count. Credential references carry intent creation time; bounded cleanup excludes live pointers and applies a one-hour orphan/obsolete grace. Registered dedicated schema consumer checks trusted installation/ready-v1, serialized by queue concurrency; resolver admission requires tenant/Jira admin. Fixed DDL is checkpointed separately; no v001 edits or hosted DDL performed. See ADR-0018.

## Local programme incident/JSM registries — 2026-11-27

Additive unapplied v003/v004 preserve immutable v001/v002. Incident evidence is durable before unique problem snapshot; policy timeline publication is single-row CAS. JSM immutable create snapshots, attempt/lease claims and unique issue mapping/state/audit settle share one row. No multi-statement transaction guarantee or native query-policy acceptance claimed. Registry checks and role-bound serial queue are explicit; no migration-on-read. Complete bounds/limitations in ADR-0019 and programme JSM contract.

## Unapplied v005 operational registry — 2026-11-28

Seven additive tables hold readiness, mutable state, command receipts, append-only audit/handoff history, expiring gate records and NOC configuration. Logical state plus pending projection envelope commits in one CAS; deterministic projection equality and matching-envelope clear preserve recovery. Final writes check current facts and active scoped references; command/gate times cannot move backwards. See ADR-0020 and local-operational-acceptance.md; native TiDB/query-policy/concurrency acceptance remains unverified.
