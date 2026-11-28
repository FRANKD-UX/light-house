# Product requirements — baseline 2026-11-24

Owner-approved scope: Light House, an ISP incident orchestration app on Atlassian Forge and JSM, for NOC engineers/managers, infrastructure engineers and support teams. Codegeist 2026 category is Apps for Specialized Industries. Release target 19 December; submission 22 December 2026 22:00 SAST.

## Functional contract

1. Receive a Zabbix webhook through a Forge webtrigger and authenticate it before processing.
2. Select a monitoring adapter, validate runtime payloads and normalise stable event/resource identities.
3. Resolve trusted ISP tenant, site and uplink mapping; enrich with carrier, team/assignee and distinct affected-customer counts.
4. Select an effective ISP priority/SLA policy; persist its immutable version, UTC deadline and warning snapshot.
5. Create an actual structured JSM incident/request and durable issue mapping; expose processing and operational states.
6. Suppress duplicate deliveries, reconcile ambiguous writes, process recovery/manual resolution/reopening and handle retry exhaustion.
7. Use native JSM notifications; directory mappings support Entra ID, Google Workspace and manual fallback. Zoho Desk follow-up after resolution is optional.

A webhook forwarding wrapper is insufficient. Business context, impact uncertainty and deterministic policy decisions are core requirements. Duplicate suppression does not imply topology-aware incident correlation.

## Nonfunctional constraints

TypeScript only, Forge Custom UI/Functions/Resolvers, REST and webhooks, no separately hosted backend. No Python backend, Next.js, AWS dependencies, GraphQL, runtime AI/LLM/Rovo, Zendesk or Microsoft Graph email. Minimise billing, dependencies and externally hosted services. All demonstrations use synthetic data; no employer assets or confidential information. Atlassian app authentication remains authoritative. All relevant writes/reads enforce installation plus ISP isolation and least privilege.

## Sprint 0 boundary

Implement shell, metadata, errors, logging, correlation IDs, tenant/adapter contracts and read-only status resolver with tests and local gates. Design inventory, persistence, ingestion, orchestration, SLA and integrations without implementing them. Register/deploy only after owner authentication and separately authorised deployment. See acceptance criteria and tracking for evidence.

## Minimum viable submission

Installable Forge app with synthetic inventory, authenticated Zabbix-compatible fixture ingestion, enrichment, unique customer impact, versioned P1/P2/P3 policies, real JSM issue creation, dashboard visibility, duplicate safety and recovery. Manual identity fallback is essential; Entra/Google adapters remain planned Sprint 6 deliverables and are schedule risks. Optional production enhancements include advanced topology correlation, large directory sync, high-volume tuning and Zoho Desk. No optional feature blocks submission.

## Sprint 0.5 approved operational extension — 2026-11-25

The owner requires a server-authoritative ISP workflow from automated intake Border Control through enrichment, impact, P1/P2/P3 assignment, JSM creation, NOC acknowledgement/triage, operational Border Control, optional departmental handoff request/acceptance/rejection/remediation/return, final restoration validation and guarded closure. Direct NOC remediation must work without handoff. Recovery is evidence only. Unknown inventory/impact must enter visible manual triage rather than being discarded. Ownership, immutable SLA history and comprehensive audit are mandatory; team changes cannot reset the deadline.

Custom UI command centre, workflow board, drawer/full workspace and embedded Jira context provide oversight; JSM remains primary ticketing. Versioned fixed workflow/checklists are proposed implementation defaults; advanced customisation/BPMN and additional timers are deferred. All original Zabbix/shared adapter, Entra, Google, manual fallback and native JSM notification requirements remain. Zoho stays optional. Sprint 0.5 changes documentation/security assessment and acceptance readiness only; no incident engine, full schema or frontend implementation. See architecture-gap-analysis.md and ADR-0015.

## Final foundation diagnostic acceptance refinement — 2026-11-26

Owner-requested correction: runtime response validation and a manual sanitised diagnostic interface replace locating the raw Bridge response in browser Network tools. The check must distinguish invocation resolution from contract validity, show validated public metadata/backend/integration readiness and correlation format, reject malformed results, permit retry and prevent overlap. No polling, operational dashboard or Sprint 1 implementation. Actual installed diagnostics, Console review and backend logs remain mandatory; simulated token tests do not satisfy installed host-theme acceptance. Deferring an unavailable installed light/dark comparison to Sprint 5 requires explicit owner approval.

## Sprint 1 delivery refinement — 2026-11-26

LH-101/LH-102 now have executable local implementation: Forge SQL schema/readiness, two-boundary tenancy, secure bootstrap, inventory, controlled lifecycle, basic manual teams, versioned demonstration configuration, durable repair and bounded seed/UI. Their acceptance remains incomplete pending the live procedure and remote review gates. No monitoring, incident workflow, impact engine, external directory, JSM writes, SLA timer or Sprint 2 implementation is included. See sprint-1-execution-report.md for exact implemented versus designed scope.

## Sprint 1 diagnostic request — 2026-11-26

If native Console evidence is unavailable, prepare a minimal read-only development diagnostic with backend Jira global administrator authorisation: expected/successful/missing migration names through migrationRunner.list(), readiness record presence, trusted environment, readiness value, schema version and returned JavaScript type, and sanitised SQL error code. Bind the trusted installation/environment in a fixed readiness query. Exclude installation identifiers, credentials, arbitrary SQL/raw database contents, migration execution, readiness modification, bootstrap and seed. Prefer the existing resolver and supported development tunnel; report required changes before any separately authorised new deployment. Implementation is local; live evidence remains open.

## Current native acceptance and continuation — 2026-11-26

Owner-provided native DEVELOPMENT tunnel evidence accepts all fifteen named checkpoints and present ready/numeric-v1 metadata with null SQL error codes. Before remaining authorised Sprint 1 mutations, establish existing Lantern Fibre active admin membership/bootstrap outcome and actual eleven-kind inventory state through read-only inspection. Generic completion text is not seed evidence. Preserve the historical HTTP 400 as unverified. Native retry/repair/isolation/persistence/cost gates remain distinct; no Sprint 2 or new deployment authorisation.

Runtime diagnostic refinement (2026-11-26): preserve reported invocation categories, handled backend codes and valid server UUID correlations without raw exception/payload exposure. Schema diagnostic failures must not all become DENIED. Local implementation and synthetic/real-SDK tests are separate from installed acceptance; native fifteen-name/ready-v1 evidence remains accepted. No new sprint or database mutation scope.

## Native hosted inventory investigation — 2026-11-26

Preserve accepted hosted health/contract/metadata and independent correlation, plus fifteen named migrations/ready numeric-v1. Inventory exception attribution and persisted seed state need read-only evidence. No tunnel restart, SQL reset/migration/bootstrap/seed or further deployment authorised. Reproduce a verified defect before correction; UI offset 4 does not establish completion. See [investigation](../operations/sprint-1-inventory-investigation.md).

### Sprint 1 bounded backend observability — owner-authorised 2026-11-26

Inventory list requests retain one internally generated correlation UUID through fixed-stage structured events. Allowlist operation/stage/outcome/duration/category/provider code only; omit raw errors, statements, parameters and identities/records. Preserve tenant membership/lifecycle and role checks and public contracts. Diagnose before proposing a functional correction. Diagnostic-only DEVELOPMENT deployment is authorised after validation, audit review and official Forge lint; no tunnel restart, installation/database mutation or Sprint 2 work.

## DEVELOPMENT 3.2.0 UUID attribution — 2026-11-26

Supplied inventory UUID 878d3b6f-6fec-4e2d-bb07-829509844583 is traced: first failure inventory.sql at 19:29:19.693Z, SQL_ERROR / SQL_EXECUTION_ERROR / ER_WRONG_ARGUMENTS. Readiness, membership, authorisation, parameters and query construction succeed; mapping/response stages are not reached. resolver.completion repeats the original failure. Health UUID 895938f9-2eff-4e56-8d47-7a3c0265dd2b independently matches success at 19:28:18.546Z. This supersedes pending-UUID/unknown-stage instructions above. LIMIT binding is the leading source-based diagnosis, not conclusively distinguished from another argument defect inside the SELECT/driver. Proposed safe-integer 1–51 literal LIMIT with bound tenant/cursor and unchanged paging/security is documented for review, not implemented or deployed. No mutation or repeated UI test; persisted baseline and remaining native gates remain open. See [investigation](../operations/sprint-1-inventory-investigation.md).

## Owner-approved pagination correction — 2026-11-26

Repository fetch limit must accept only number safe integers 1–51 and render only their decimal integer into shared inventory LIMIT; tenant/cursor remain bound in order. Preserve diagnostics, tenant/authorisation/lifecycle/keyset/lookahead behaviour and all eleven types. Owner authorises existing DEVELOPMENT deployment after required gates and explicitly instructs autonomous correction of routine implementation/testing defects. Generic diagnostic mock typing is resolved; all 148 tests and local validation pass. No native diagnosis proof is inferred. No other database/install/tunnel operation, merge or Sprint 2 authorised. See the latest investigation and audit for deployment/runtime evidence.

## Owner-requested automated native acceptance — 2026-11-26

Provide reusable TypeScript/Playwright infrastructure in isolated `e2e/`, pinned only to the existing approved DEVELOPMENT installation. Owner performs initial interactive Atlassian login/MFA; private gitignored session reuse detects missing/expired auth without bypass. Suite uses accessible rendered Custom UI controls for health, schema ready v1, Lantern Fibre admin, sites/carriers/sla_tiers and available next pages. Require fresh loading/completion, actual persisted display counts/fields/lifecycle/version, bounded increasing duplicate-free paging, fixed error categories and UTC duration evidence. Write private JSON/escaped HTML reports and terminal summary; collect allowlisted hosted logs and distinguish displayed UUIDs, unique temporal candidates and ambiguous/unmatched events. Never collect raw screenshots/traces/cookies/error/payload dumps or click mutation controls. No new Forge permission/endpoint/backend, deployment or database mutation. CI validates harness logic without credentials; owner desktop authentication/hosted execution remain separate. See [runbook](../../e2e/README.md).

## Authentication correction requirements — 2026-11-26

Owner requests stage-specific safe diagnostics for authentication, executable/display/dependency and private-storage failures plus credential-free `test:e2e:doctor`. Support normal Ubuntu desktop interactive SSO/MFA with private atomic session storage; preserve all existing application/harness tests and browser fixtures. No deployment, tunnel, hosted data or permission changes. See E2E README for category-specific remedies and audit for actual results.

## Browser compatibility correction — 2026-11-26

E2E browser channel is selected through `LIGHT_HOUSE_E2E_BROWSER_CHANNEL`: installed Chrome Stable (`chrome`, default) or Playwright full Chromium (`chromium`). All browser workflows share sandbox-enabled launch settings; invalid values/root execution fail closed. Never weaken AppArmor/kernel settings or reuse a personal profile. Preserve private atomic session storage and existing read-only target/tenant policy. Investigate audit-count variability separately without dependency upgrades.

## Sprint 1 native evidence refinement — 2026-11-26

DEVELOPMENT 3.3.0 bounded LIMIT correction is functionally accepted for sites/carriers/sla_tiers. Native reads verify four first-batch records plus the additional repair-probe site; full fixture/replay/repair/isolation requirements remain in force. Hosted list lifecycles succeed independently; entity-to-UUID attribution remains unmatched without click intervals. Do not turn the application-specific binding diagnosis into a provider-wide LIMIT restriction. Browser launch is resolved, authenticated hosted automation remains blocked, and isolated read-only harness controls are preserved. Remaining requirements and applicable authorisations are enumerated in the [current completion matrix](sprint-1-execution-report.md#consolidated-sprint-1-completion-plan--2026-11-26); no acceptance requirement or later-sprint boundary is weakened.

## Eleven-kind baseline and bounded acceptance — 2026-11-27

All eleven native UI retrieval kinds now pass; preserve empty-success versus failed/stale distinction and temporal-candidate versus exact UUID attribution. Customers TypeError historical cause stays unverified; no corrective implementation claim. Baseline does not waive total counts, populated rendering, pagination, physical schema, receipts/intents, security/recovery or current usage requirements. Prepare one conditional existing-installation Phase B tranche with explicit writes, identities, estimated 2,000 incremental SQL calls within existing 5,000 cumulative ceiling, stop conditions and browser instructions; held expiry/fault/request-driver/deployment/second-installation gates remain separate. See current execution report/runbook. No requirement or architecture scope expands to Sprint 2.

## Owner-approved Phase B prerequisite boundary — 2026-11-27

The bounded functional session is now approved subject to ALL five prerequisites before ANY mutation, including independent seed/repair. Additional request limit2,000 within cumulative5,000 is unchanged. Missing identities/consent or usage/state evidence cannot be waived by scope approval. Use the self-contained Cloud Browser execution prompt in the live runbook; report inaccessible/untested separately from failed operations. No runtime, integration or architecture scope changes.

## Proposed independent Phase B gates — 2026-11-27

Partition prerequisites, not acceptance criteria: B.1 requires existing consenting admin and all resource/state/receipt/stop gates; B.2 additionally requires named consenting lower-role identities and safe supported grant/expiry/access tests. Missing B.2 identities must not unnecessarily block independently approved B.1. Revised authorisation review precedes mutation. All original shared write limits/2,000 additional/5,000 cumulative ceiling remain. Recovery, full RBAC/expiry/isolation and partial migration retry/concurrency are not completed by clean probe/rerun/admin success. No new runtime/architecture scope.

## Delivery governance reassessment — 2026-11-27

Required classification is separate implementation/development progression, concrete development deployment/runtime authority, protected integration/merge and final release acceptance. Sprint1 may be implementation-complete locally with outstanding native release requirements; full acceptance is not asserted. No tenant/auth/expiry/reference/CAS/receipt/security regression/control may be weakened. Missing native identities/second installation are release evidence dependencies, not an architectural prerequisite for writing Sprint2 port/use-case code. See ADR-0017 and execution-report classification D/DEP/R/O.

R-01–R-14 in acceptance-criteria.md remain mandatory release backlog with owner/environment/test evidence. B.1 independent administrator acceptance remains bounded/reviewed; B.2 identities/expiry/access evidence and genuine second installation remain blocked without appropriate consent. No new tests, infrastructure, identities/installations, implementation scope, deployment, mutation, publication/merge or release is authorised by a governance recommendation.

## LH-103 implementation boundary — 2026-11-27

Owner authorises local Zabbix ingestion and automated Border Control only. [Sprint2 report](sprint-2-execution-report.md) distinguishes local adapter/intake/inbox/lease/mapping behavior from missing SDK binding, runtime modules, UI and actual Zabbix transport. No incident/SLA/JSM implementation or operational recovery closure is included. All canonical security/isolation/release requirements remain mandatory.

## LH-103 local implementation completion — 2026-11-27

Runtime modules, source credentials, strict ingestion, durable inbox/idempotency/async Border Control, bounded recovery, minimal operational UI and terminal synthetic acceptance tooling are implemented locally. See sprint-2-execution-report.md for exact evidence versus untested native/source compatibility. No incident enrichment, SLA execution, JSM closure, external identity replacement, runtime AI, new hosted backend or additional installation introduced.

## Autonomous programme mandate — 2026-11-27

Owner explicitly authorises autonomous local implementation across the remaining canonical roadmap with coordinated native specialists and durable continuation state. Prioritise the complete authenticated alert→impact/SLA→actual JSM→visibility vertical slice; no routine sprint continuation approvals. ADR-0017 separates local progress from native/release acceptance, which remains mandatory. External mutation/deploy/permission-risk/resource/publication/licence gates persist. ADR-0019 records proposed local incident/SLA/JSM mechanisms and limitations; all original identity/handoff/closure/native-notification requirements remain.

## Durable operational slice — 2026-11-28

Local catch-up, canonical recovery-evidence binding and durable accepted-return/accountable-engineer workflow now extend the POC. These implement owner requirements under ADR-0020 proposed mechanisms, not native acceptance. Actual Jira transition confirmation, reassignment, scheduling/native SLA reconciliation, identity providers/full UI and release requirements remain mandatory.

2026-11-28 resumed implementation: same-team engineer reassignment and current-page NOC operational board are implemented locally pending integrated validation. Mutable operational summaries are explicitly separate from creation snapshots; missing readiness is unverified. Native transition intent/gateway components are unregistered, provide no SQL adapter or confirmed transition provenance, and leave closure disabled. Native enforcement, full UI/embedded context, scheduling, identity integrations and all release acceptance remain mandatory.

Additive v006 transition persistence and read-only JSM discovery are being integrated locally under ADR-0021. Migration/runtime registration, concrete native enforcement preflight and confirmation provenance are absent. No scope, deployment, permission, queue or native write is added. Mandatory guarded closure and native workflow bypass tests remain open.
