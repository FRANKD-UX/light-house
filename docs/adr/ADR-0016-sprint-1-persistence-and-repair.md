# ADR-0016: Sprint 1 physical persistence and bounded repair

Date: 2026-11-26

Status: Implemented locally under the explicit Sprint 1 request; live acceptance pending.

Owner-approved constraints: Forge-native SQL, two tenancy boundaries, parameterised writes, expected versions, immutable policy history, explicit development-only seeding, no ORM/transactions/cascades, no deployment without further authorisation. Operational SLA and retention defaults are not approved by this ADR.

Implementation choices: fifteen application tables in an immutable v001 JSON DDL snapshot. Inventory keys are (tenant_id, id); UUIDv4 values use VARCHAR(36). Case-sensitive utf8mb4_bin keys preserve external identifier case; codes are trimmed and length bounded. UTC values use canonical ISO VARCHAR(24), avoiding implicit timezone conversion. SQL INT stores bounded positive durations/capacity/version; warning offsets also allow zero. References are explicit columns/indexes, not JSON-only records or an ORM.

Each ISP has at most one pending_mutation VARCHAR(8192). A conditional NULL-to-intent write admits one inventory/configuration command. The complete target row and expected version are durable before target writes. Reference/lifecycle checks repeat under admission. Target rows carry a bounded pending command/audit intent (VARCHAR(4096)); materialisation inserts a uniquely keyed minimal mutation receipt before clearing target intent and then the matching tenant intent. No SQL lock survives an API call. An administrator replays the same saved intent after a partial failure; concurrent original/replay writes converge through UUID/expected-version checks and receipt identity. An old completion cannot clear a different tenant command. Reads remain available; conflicting mutations return REPAIR_REQUIRED.

Published policy admission claims the SLA tier revision inside this tenant gate, then idempotently promotes the exact configured draft or inserts an immutable version. Publication actor comes from the trusted session. Draft content uses expected-version edits; only published content is immutable. Publication rejects overlaps, duplicate versions and gaps after an existing finite interval. An open-ended published version deliberately prevents appending another version until a separately reviewed supersession operation exists. No timer, severity/impact algorithm or contractual policy is selected: priority mapping remains explicitly demonstration-only/manual-review.

ISP names and suspension/retirement use expected versions. Retirement requires no live inventory and preserves data; no cleanup is implemented. Jira administrators can restore suspended ISP access through the bootstrap path; retired ISPs cannot be reactivated. Manual engineer records may have a null account only while unmapped (or disabled); synthetic accounts are never fabricated. Team membership is independent of tenant access.

Migrations run only after a development administrator explicitly queues them, through a single concurrency-keyed async consumer. SQL module consent is required on upgrade. Ready is written only after every named checkpoint is present; absent/provisioning/failed states deny inventory operations. DDL/checkpoint partial failures retry safely with idempotent CREATE IF NOT EXISTS. Three attempted executions per queued job bound retries; later retry is explicit. No install event, read path, schedule or production migration starts them.

Evidence: local SQL-adapted tests verify relationships, uniqueness, CAS and injected failures, including simultaneous original/replay. They do not establish Forge query-policy compatibility, affectedRows behaviour on TiDB, actual migration concurrency or installation isolation.

Official references, verified 2026-11-26: [SQL](https://developer.atlassian.com/platform/forge/storage-reference/sql/), [schema API](https://developer.atlassian.com/platform/forge/storage-reference/sql-api-schema/), [DML and affectedRows](https://developer.atlassian.com/platform/forge/storage-reference/sql-api/), [query policy](https://developer.atlassian.com/platform/forge/storage-reference/sql-query-policy/), [async concurrency](https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/), [trusted runtime context](https://developer.atlassian.com/platform/forge/runtime-reference/app-context-api/).

## Owner-authorised read-only diagnostic — 2026-11-26

Prepare a development-only, Jira-administrator-authorised read using the existing resolver, supported migrationRunner.list() and fixed parameterised metadata SELECT. No readiness mutation, migration execution, tenant bootstrap or seed is part of this path. Installation/environment and actor remain server-derived; no arbitrary SQL/context input or sensitive identifiers/results may escape. The public contract exposes known registry names, readiness presence/value and version/type with allowlisted SQL error codes; unknown values/names are redacted. Prefer the existing installed module through an owner-run tunnel; deployment remains a separate owner gate. This adds observability only and does not relax readiness acceptance or authorise repair. See the [live runbook](../operations/sprint-1-live-acceptance.md).

## Native acceptance update — 2026-11-26

Owner reports native DEVELOPMENT tunnel diagnostic exactly matches all fifteen named checkpoints and present ready/numeric-v1 metadata, with null SQL errors. Accept this sub-gate; all other live persistence/repair/isolation gates remain separate. Existing Lantern Fibre admin display requires fresh read-only inventory/bootstrap-state verification before further mutation. No design, DDL, approval boundary or dependency change; historical HTTP 400 cause remains unverified.

## Bounded backend observability approval — 2026-11-26

Owner authorises diagnostic-only DEVELOPMENT deployment after required gates. List instrumentation uses an application diagnostics port with infrastructure logging; existing tenant predicates, membership/lifecycle/role enforcement, SQL, bindings and public response contracts remain intact. No additional SQL path or data mutation. Serialization is checked before callback completion to distinguish it from row mapping; SDK/browser delivery remains a separate observation. Functional corrections require a separately presented evidence-based proposal. See the inventory investigation record for stage meanings and official SQL evidence limits.

## Owner-approved bounded pagination correction — 2026-11-26

Owner authorises repository limit validation (safe integer number 1–51), decimal-only LIMIT rendering and removal of that binding while retaining tenant/cursor binding order and existing semantics/diagnostics. Existing DEVELOPMENT deployment is conditional on required quality gates. No new persistence design, schema, dependency or permission. The resumed request authorises autonomous correction of routine implementation/testing defects. Test-spy generic typing is resolved with a contract-preserving wrapper; all 148 tests and local validation pass. LIMIT compatibility remains a hypothesis pending controlled hosted read evidence; see the latest investigation for deployment/runtime results.

## Owner-authorised native acceptance infrastructure — 2026-11-26

The owner requests a terminal-driven TypeScript/Playwright harness as Sprint 1 engineering infrastructure. The isolated `e2e/` workspace has its own pinned development dependencies/lockfile and TypeScript build; it is never a Forge runtime dependency or resource. It drives only the existing hosted Custom UI at the explicitly approved DEVELOPMENT target, with owner interactive Atlassian login/MFA and locally private session reuse. No new module, permission, endpoint, backend, egress or SQL path is introduced. Fresh rendered completion, real counts and conservative correlation evidence replace repetitive manual clicks. This request explicitly prohibits further deployment/database mutation for the harness. See [E2E runbook](../../e2e/README.md). This infrastructure does not complete the native LIMIT diagnosis or other Sprint 1 persistence acceptance by itself.

## Authentication harness correction — 2026-11-26

Owner requests actionable startup diagnostics and a local-only prerequisite doctor, with no further deployment or hosted mutation. Authentication remains owner-driven Atlassian SSO/MFA; no identity, runtime, persistence or permission change. Doctor uses blank local browser pages and disposable owner-only synthetic storage, checks existing session metadata without reading contents, and never treats browser installation or local fixtures as hosted acceptance. Preserve Chromium sandbox and atomic private-state writes. Generic historical errors cannot establish the owner desktop's failing prerequisite. See the updated E2E README and audit for actual evidence.

## Browser compatibility correction — 2026-11-26

Owner requests installed Google Chrome Stable support after downloaded Chromium sandbox failures were confirmed on the workstation. E2E defaults to `chrome`, allows explicit `chromium`, and shares a mandatory sandboxed launch configuration across doctor/auth/headless/headed acceptance and synthetic fixtures. Root execution and invalid channel values are rejected, with no fallback or personal profile. This is local test tooling only: no Forge runtime/persistence/identity/dependency change or hosted acceptance claim. See E2E README for official Playwright references verified 2026-11-26.

## Native bounded LIMIT acceptance — 2026-11-26

Owner-observed DEVELOPMENT 3.3.0 sites/carriers/sla_tiers reads pass with five persisted synthetic records (four first-batch records plus the probe). Hosted logs independently verify eight complete list lifecycles; entity-to-correlation mapping remains unmatched without exact click intervals. This is strong runtime support for the bounded LIMIT-binding diagnosis for this application path, not a provider-wide prohibition. Keep safe-integer 1–51 decimal rendering and bound tenant/cursor values; no further persistence design change. Full native seed/replay/repair/isolation/policy/usage requirements remain partial/untested. Browser launch is resolved; authenticated harness execution remains blocked by authentication restrictions. See [investigation](../operations/sprint-1-inventory-investigation.md#native-correction-functional-acceptance--2026-11-26) and [completion plan](../project/sprint-1-execution-report.md#consolidated-sprint-1-completion-plan--2026-11-26).
