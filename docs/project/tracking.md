# Engineering backlog

**Owner decision (2026-11-27):** ADR-0017 accepted; Sprint1 IMPLEMENTATION-COMPLETE LOCALLY — RELEASE ACCEPTANCE OUTSTANDING. Local checkpoint and isolated LH-103 implementation authorised. No release/production/deployment/native mutation/publication/merge authority. Prior proposal/hold entries are dated history.

**Current delivery recommendation (2026-11-27):** Implementation-complete locally with mandatory release acceptance outstanding; GO for local Sprint2 after explicit owner scope/governance approval, not deploy/merge/release authority. See [gate classification](sprint-1-execution-report.md#delivery-governance-reassessment--2026-11-27-current-recommendation). Prior evidence and untested requirements remain preserved.

**Current review:** B.1 admin-only/B.2 consenting-identity partition proposed; revised authorisation review before mutations. Recorded286 SQL requests require lag-aware reconciliation; prior accepted reads preserved.

Updated 2026-11-27 (eleven-kind native baseline; Phase B approved conditionally, prerequisites blocked). P0 critical path/security; P1 planned supporting delivery; P3 stretch. “Documented” is design completion, not implemented functionality. Sprint 0 local evidence and external gates are recorded separately in audit and acceptance criteria. Current Sprint 1 evidence supersedes historical foundation blockers; see sprint-1-execution-report.md.

## LH-001 — Repository baseline

- Sprint: 0
- Description: Inspect empty repo/tooling, establish minimal main commit and isolated sprint branch.
- Priority: P0
- Dependencies: None
- Acceptance criteria: Baseline commit exists, branch correct and prior work preserved.
- Status: Implemented locally
- Verification evidence: Git history/status and audit baseline.
- Known blockers: None after authorised local Git write escalation.

## LH-002 — Forge and competition research

- Sprint: 0
- Description: Verify official capabilities, constraints and competition rules with dates.
- Priority: P0
- Dependencies: LH-001
- Acceptance criteria: 20 research topics sourced; unknown/provider/runtime conclusions labelled.
- Status: Documented
- Verification evidence: forge-capability-assessment.md official source/date matrix.
- Known blockers: Authenticated runtime/provider-specific checks deferred.

## LH-003 — Engineering documentation

- Sprint: 0
- Description: Create persistent conventions, all requested architecture/operations/project/testing/hackathon documents.
- Priority: P0
- Dependencies: LH-002
- Acceptance criteria: Meaningful content, linked decisions and diagrams; no empty headings.
- Status: Documented
- Verification evidence: README, AGENTS, docs tree.
- Known blockers: None.

## LH-004 — Logical data model

- Sprint: 0
- Description: Design required entities, identities, keys/indexes, retention/classification and integrity.
- Priority: P0
- Dependencies: LH-002
- Acceptance criteria: All required entities modelled; FK/partial-write limitations explicit.
- Status: Documented
- Verification evidence: architecture/data-model.md and persistence.md.
- Known blockers: Live schema acceptance belongs to Sprint 1.

## LH-005 — Incident lifecycle

- Sprint: 0
- Description: Separate processing and operational state machines with retries and ordering.
- Priority: P0
- Dependencies: LH-004
- Acceptance criteria: Duplicate/recovery/rate/ambiguous create/manual/reopen cases specified.
- Status: Documented
- Verification evidence: architecture/event-lifecycle.md.
- Known blockers: Jira searchable-marker verification belongs to Sprint 4.

## LH-006 — SLA architecture

- Sprint: 0
- Description: Define effective versioned P1/P2/P3 UTC elapsed-time engine and native JSM distinction.
- Priority: P0
- Dependencies: LH-004
- Acceptance criteria: Warning/deadline/history/unknown-impact/reconciliation specified.
- Status: Documented; owner assumption review pending
- Verification evidence: architecture/sla-engine.md and ADR-0009.
- Known blockers: Owner 24/7 policy decisions.

## LH-007 — Security architecture

- Sprint: 0
- Description: Threat model ingress, tenancy, configuration, credentials, logs and external failures.
- Priority: P0
- Dependencies: LH-004,LH-005
- Acceptance criteria: All listed threats mapped to controls and future verification.
- Status: Documented
- Verification evidence: architecture/security.md, SECURITY.md.
- Known blockers: Auth parameters and retention require owner review.

## LH-008 — Application scaffold

- Sprint: 0
- Description: Implement minimal Custom UI/status backend, metadata/errors/logging/correlation/context/adapter contracts.
- Priority: P0
- Dependencies: LH-002,LH-007
- Acceptance criteria: TypeScript implementation and meaningful automated tests; honest development UI.
- Status: Implemented and deployed to development; installed runtime pending
- Verification evidence: src/, static/app/, tests/unit/, manifest.yml.
- Known blockers: Genuine app.id preserved; official lint/deploy/install pass; owner runtime evidence pending.

## LH-009 — Quality gates and CI

- Sprint: 0
- Description: Configure strict TS, ESLint, Prettier, Vitest coverage, deterministic install/build, no-deploy CI.
- Priority: P0
- Dependencies: LH-008
- Acceptance criteria: Applicable local validation passes; CI on PR/main; failures visible.
- Status: Verified locally and remotely — validate passes on PR #1
- Verification evidence: package scripts/lockfile, npm ci/validate, ten tests; successful PR Validate runs 45775501033 and 45775879468; audit.
- Known blockers: No PR quality-check blocker; merge waits for LH-013 installed response/frontend/theme verification.

## LH-010 — Prioritised backlog

- Sprint: 0
- Description: Track every task with dependencies, criteria, status/evidence/blockers and critical path.
- Priority: P1
- Dependencies: LH-003
- Acceptance criteria: Sprints 0–9 and independent Zoho stretch represented.
- Status: Documented
- Verification evidence: This file and roadmap.md.
- Known blockers: Owner calendar/capacity review.

## LH-011 — Architecture decisions

- Sprint: 0
- Description: Record 14 ADRs with status/context/decision/rationale/consequences/alternatives/verification/references.
- Priority: P0
- Dependencies: LH-002,LH-004,LH-005,LH-006,LH-007
- Acceptance criteria: Approved constraints distinguished from proposed defaults.
- Status: Documented
- Verification evidence: docs/adr/ADR-0001 through ADR-0014.
- Known blockers: Proposed decisions pending owner review.

## LH-012 — Demonstration design

- Sprint: 0
- Description: Design synthetic multi-site environment and exerciseable ten-step real-JSM scenario.
- Priority: P1
- Dependencies: LH-005,LH-006,LH-010
- Acceptance criteria: Live/simulated distinction, duplicate/recovery and policy changes specified.
- Status: Documented
- Verification evidence: hackathon/demonstration-scenario.md.
- Known blockers: Demo implementation belongs to later sprints.

## LH-013 — Registered development runtime acceptance

- Sprint: 0
- Description: Owner logs in/registers; authorises development deployment and installs app.
- Priority: P0
- Dependencies: LH-008,LH-009
- Acceptance criteria: Real ARI, Forge lint, actual module/Bridge/CSP/theme test and safe logs recorded.
- Status: Runtime accepted for development with explicit Sprint 5 visual deferral; protected merge/post-merge checks next
- Verification evidence: Genuine identity preserved; elevated official lint exit 0/no issues, deploy 2.1.0 and Jira development installation succeeded; owner diagnostic contract/UUID confirmed, matching backend.status/success at 2026-11-26T08:00:25.634Z. See foundation-acceptance-report.md.
- Known blockers: No remaining mandatory runtime blocker. Scoped owner Console retry passed without Light House iframe errors; host/browser noise documented. Installed theme selector unavailable; owner-approved Sprint 5 deferral remains unverified visual acceptance. Final protected merge/main/post-merge evidence is recorded in PR #1 after execution.

## LH-014 — Forge SDK dependency advisory review

- Sprint: 0 follow-up / release gate
- Description: Remediate or explicitly assess current Forge Bridge transitive ProseMirror/glob/minimatch advisories before release.
- Priority: P0 before deployment/release
- Dependencies: LH-009
- Acceptance criteria: Review current official upstream fixes and compatibility; deterministic install, audit and behaviour/build checks after any change; document residual exposure and owner disposition.
- Status: Open — owner accepted residual risk for isolated development only; production blocked
- Verification evidence: Current Sprint 1 full/production audits exit 1: eleven affected package findings, five high/six moderate; zero new advisory identifiers. Exact versions/paths, exposure and renewed owner development-only disposition in dependency-security-assessment.md/readiness review. Official inspected backend map excludes affected leaf sources; dependencies remain unresolved.
- Known blockers: Current SDK tree pins affected components; suggested Bridge major downgrade and transitive overrides are not verified remedies. No force fix applied.

## LH-101 — Tenancy and Forge-native persistence

- Sprint: 1
- Description: Forge SQL schema/readiness, server-authoritative membership, tenant-scoped repositories, optimistic writes and bounded durable tenant/aggregate repair.
- Priority: P0
- Dependencies: Accepted foundation cc82f504; LH-004,LH-007.
- Acceptance criteria: Real SQL migrate/retry; two-tenant/two-installation denial; parameterised operations; durable repair.
- Status: IMPLEMENTATION-COMPLETE LOCALLY — RELEASE ACCEPTANCE OUTSTANDING (ADR-0017 accepted).
- Verification evidence: Executable repositories, application/resolver/UI paths, local relational simulation and mock-SDK tests; Sprint 1 execution/security reports.
- Known blockers: Named migration/ready-v1 sub-gate and exact-UUID hosted health are accepted. DEVELOPMENT 3.3.0 now has native UI retrieval acceptance across eleven types; seven exact windows map to unique temporal candidates, one serialization-success event unavailable. Remaining physical schema, retry/concurrency, native roles/two-ISP/two-installation isolation, CAS/duplicates, repair/receipts, policy and usage gates remain partial/untested. Genuine second installation and final publication/merge require separate approval; final-head CI/review remains open. See current execution-report completion matrix.

## LH-102 — Synthetic ISP inventory

- Sprint: 1
- Description: Sites, carriers, uplinks, synthetic customers, independent services/dependencies, basic teams/manual engineers, demonstration policy configuration and bounded idempotent seed.
- Priority: P0
- Dependencies: LH-101.
- Acceptance criteria: Multi-site primary/backup inventory, same-tenant/lifecycle validation and distinct service identities.
- Status: IMPLEMENTATION-COMPLETE LOCALLY — RELEASE ACCEPTANCE OUTSTANDING (ADR-0017 accepted).
- Verification evidence: Eleven inventory entity kinds, two-ISP fixtures, UI operations, negative/security and retry/concurrency tests.
- Known blockers: All eleven native UI retrieval kinds pass, including seven exact-window empty successes and prior uplinks confirmation. Counts/fields for uplinks are unspecified; total counts/populated empty-kind rendering remain unverified. Physical schema/intents/receipts/current usage are access-blocked; full seed/replay/reload, relationships/roles/expiry, CAS/duplicates, repair, policy/retry and pagination remain unaccepted. Customers TypeError did not recur, historical cause unverified with no correction claimed. Bounded Phase B is now approved conditionally; all mandatory prerequisites remain unverified, so no mutations initiated. Self-contained Cloud Browser prompt is ready. Deployment/publication/merge/Sprint 2 remain prohibited.

## LH-103 — Authenticated Zabbix ingestion

- Sprint: 2
- Description: Implement Zabbix/shared monitoring port, credentials/rotation, automated intake Border Control, stable inbox and async dispatch; retain valid unmapped events in visible manual triage.
- Priority: P0
- Dependencies: LH-101,LH-102
- Acceptance criteria: Pinned source version; wrong/replayed/oversized/tenant-spoof payload denied; duplicates one receipt; queue gap repair.
- Status: Not started
- Verification evidence: Adapter contract and zabbix/security design.
- Known blockers: Live ingress and auth parameter review.

## LH-104 — Incident enrichment and SLA engine

- Sprint: 3
- Description: Implement network enrichment, versioned known/unknown impact, configurable ISP P1/P2/P3 deadline/warning engine and fixed server-authoritative operational state machine.
- Priority: P0
- Dependencies: LH-102,LH-103,LH-006
- Acceptance criteria: UTC/effective boundary tests, immutable snapshots, no SLA reset on team changes, unknown/failover handling; role/gate/version denial and direct NOC route tests.
- Status: Not started
- Verification evidence: SLA and lifecycle designs.
- Known blockers: Owner ADR-0009 assumptions.

## LH-105 — Actual JSM lifecycle and notifications

- Sprint: 4
- Description: Create real JSM requests, reconcile ambiguity, sync guarded transitions and implement basic departmental handoff request/accept/reject/remediation/return with native notifications; recovery evidence never bypasses final closure.
- Priority: P0
- Dependencies: LH-104,LH-005
- Acceptance criteria: Actual issue key, duplicate/timeout reconciliation; full handoff/rejection/return audit with continuous SLA, direct NOC route, ownership matrix sync and target native-transition restriction evidence. Final recovery/closure hardening in Sprint 7.
- Status: Not started
- Verification evidence: JSM integration/event lifecycle designs only.
- Known blockers: Site project/request-type/field/workflow/recipient configuration.

## LH-106 — Operational dashboard, incident drawer and Jira context

- Sprint: 5
- Description: Implement command centre/workflow board, incident drawer/minimal full workspace and embedded Jira issue context, exposing ownership/gates/deadlines/manual triage/retries with backend authorisation.
- Priority: P0
- Dependencies: LH-105
- Acceptance criteria: Honest live states, tenant-isolated views, keyboard/theme checks, forged admin invokes denied.
- Status: Not started
- Verification evidence: Sprint 0 shell only.
- Known blockers: Lifecycle data and permissions.

## LH-107 — Directory adapters and manual mapping

- Sprint: 6
- Description: Implement Entra ID, Google Workspace and always-available reviewed manual identity mapping, team administration and tenant/site administrative permission configuration; Atlassian authentication remains authority.
- Priority: P1
- Dependencies: LH-101,LH-106
- Acceptance criteria: Provider consent/revocation, ambiguity/disabled subject tests; no replacement login or automatic role grants.
- Status: Not started
- Verification evidence: Identity/integration designs; provider details unverified.
- Known blockers: Owner provider consent and current REST capability verification.

## LH-108 — Recovery, reconciliation, guarded closure and security hardening

- Sprint: 7
- Description: Implement final restoration validation and guarded closure; harden out-of-order recovery, drift reconciliation, native Jira bypass prevention, tenant/auth/rate controls and dependency exposure.
- Priority: P0
- Dependencies: LH-103,LH-105,LH-106
- Acceptance criteria: Recovery alone cannot close; stale/missing validation, native UI/REST/automation bypass and open handoffs denied; cross-tenant/auth/ambiguous-write tests pass, audit findings remediated or explicitly dispositioned before deployment/release.
- Status: Not started
- Verification evidence: Regression matrix and threat model.
- Known blockers: Implemented flows and live environment.

## LH-109 — Regression, deployment and release candidate

- Sprint: 8
- Description: Run full regression matrix, prepare release candidate, owner-authorised deployment/sharing, install instructions and fresh-site verification.
- Priority: P0
- Dependencies: LH-108
- Acceptance criteria: Working installation link, setup succeeds on independent JSM site, cost/scopes reviewed.
- Status: Not started
- Verification evidence: Deployment/distribution procedure only.
- Known blockers: Explicit production/distribution authorisation; real runtime evidence.

## LH-110 — Demonstration and submission

- Sprint: 9
- Description: Run synthetic exercise, publish approved video, assemble description/instructions and owner-submit.
- Priority: P0
- Dependencies: LH-109
- Acceptance criteria: All ten demo steps, public under-five-minute video, eligible English submission and confirmation before deadline.
- Status: Not started
- Verification evidence: Hackathon designs/checklists only.
- Known blockers: Working release, owner eligibility/IP review and publishing/submission authorisation.

## LH-190 — Zoho Desk post-resolution follow-up

- Sprint: Stretch
- Description: Optional consented REST adapter with separate intent/reconciliation after resolution.
- Priority: P3
- Dependencies: LH-105,LH-108
- Acceptance criteria: One safe follow-up per resolution cycle, optional failures do not block JSM or submission.
- Status: Not started — non-blocking
- Verification evidence: Integration design only.
- Known blockers: Unverified provider auth/API/cost and owner authorisation.

## Critical path and handover

Accepted foundation → Sprint 1-specific LH-014 reassessment and live SQL acceptance → LH-101 → LH-102 → LH-103 → LH-104 → LH-105 → LH-106 → LH-108 → LH-109 → LH-110. Identity adapter work has independent provider consent risk; manual fallback is essential. LH-190 never blocks this path. See roadmap.md for minimum submission versus optional production enhancements and risk-register.md for schedule pressure.

Next action is owner review of proposed ADRs and remaining installed-runtime gate, not an automatic start of Sprint 1. All local quality results must be read from audit; no mocked test is credited as runtime validation.

## LH-015 — Sprint 0.5 stabilisation and architectural alignment

- Sprint: 0.5, existing sprint-0/engineering-foundation branch
- Priority: P0
- Dependencies: LH-001–LH-014
- Description: Independently verify baseline, align conceptual operational workflow, assess security findings and prepare platform/CI acceptance.
- Acceptance criteria: Gap analysis/ADR-0015, ERD/entity decisions/ownership/threat model, per-package audit, local gates, actual Forge lint attempt, smoke/remote commands and honest blocked gates recorded; clean committed tree.
- Status: Local stabilisation documented and checked; external acceptance blocked, not sprint-wide completion.
- Evidence: architecture-gap-analysis.md, dependency-security-assessment.md, audit.md and sprint-0.5-execution-report.md.
- Blockers at Sprint 0.5: Missing genuine app.id/site/deployment authorisation (registration and site existence now owner-confirmed in Sprint 0.6; exact target/runtime still pending); LH-014 owner disposition/upstream patch; remote setup/push authorisation and actual CI run; proposed policy/site enforcement decisions.

## LH-191 — Advanced workflow customisation and optional timers

- Sprint: Beyond mandatory MVP
- Priority: P3
- Dependencies: LH-104,LH-105,LH-108
- Description: Evaluate configurable workflow/checklists and acknowledgement/handoff/department/validation timers only after explicit scope approval; no generic BPMN/designer framework.
- Acceptance criteria: Separate proposal, cost/capacity and security review; preserve overall incident SLA.
- Status: Deferred, non-blocking
- Evidence: ADR-0015, data-model.md and sla-engine.md.
- Blockers: Owner prioritisation; no automatic critical-path expansion.

Sprint 0.5 exit does not authorise Sprint 1. Original deadline remains 22 December 2026 22:00 SAST (20:00 UTC); original integration requirements remain mandatory. Teams/manual membership needed for handoffs cannot wait for directory integration; Sprint 1 provides minimal configuration, Sprint 6 provides full administration. Additional timers and LH-190/LH-191 do not block the MVP.

## LH-016 — Sprint 0.6 tooling and platform acceptance

- Sprint: 0.6 (no Sprint 1 implementation)
- Priority: P0
- Dependencies: LH-008, LH-009, LH-013, LH-014
- Acceptance criteria: Preserve registered identity, isolate third-party tooling, run independent local gates, assess official skills/MCP, record platform blockers, security/cost/environment/remote procedures and commit locally.
- Status: Local tooling/validation/review/documentation complete; external gates pending.
- Evidence: sprint-0.6-execution-report.md; 10 tests/3 files, 100% configured coverage; official lint exit 1 (credential-store access); full/prod audit exit 1 (8 packages). No dependency changes.
- Known blockers: Authenticated official lint, owner LH-014 disposition, billing/site/deploy/install approval, actual runtime and remote CI acceptance. No Sprint 1 start authorised.

## Final foundation acceptance update — 2026-11-26

The project owner explicitly authorises development deployment/install on the confirmed owner-controlled Jira site, public GitHub source publication after review, push/PR/CI and conditional history-preserving merge. No staging/production deployment, app distribution, paid provisioning, licence selection or Sprint 1 start is authorised. LH-014 is accepted with documented residual risk for isolated synthetic development only; it remains open, not remediated. See dependency-security-assessment.md and foundation-acceptance-report.md for current evidence and remaining gates. Earlier permission and registration blockers are historical.

## Owner-authorised privacy cleanup and publication continuation — 2026-11-26

The temporary publication hold is superseded by explicit owner approval to correct unpublished author/committer emails and equivalent documentation-only privacy details. Private recovery bundle, original refs, complete old/new commit mapping and redaction record are retained outside the repository. All application/configuration trees, commit messages/names/timestamps and branch relationships are verified unchanged except approved documentation privacy/hash-reference corrections. Both branches are consistent; intended metadata has no Gmail address. Repeated history/current-source review passes. Public repo/push/PR/CI are authorised to continue; runtime/CI remain mandatory before conditional merge. No force push, backup publication or next sprint.

Public GitHub execution: https://github.com/FRANKD-UX/light-house is PUBLIC; cleaned main and foundation pushed; PR #1 created. Free secret scanning/push protection/Dependabot alerts/private reporting and main checks configured. Remote CI result must be recorded after actual completion; merge remains conditional on runtime acceptance. No next sprint.

Remote CI passed for acceptance commit 85f542c: [Validate run 45775501033](https://github.com/FRANKD-UX/light-house/actions/runs/45775501033). PR #1 remains open; remaining runtime response/frontend-error/theme verification prevents merge. Main is the cleaned baseline ff2939c; post-merge CI has not run. The evidence-only documentation update is verified again on its own head before handover.

## Focused final runtime correction — current continuation

Within existing Sprint 0 Gates B/C and PR #1: corrected discarded getStatus result with literal runtime contract/UUIDv4 validation, safe public projection and manual diagnostics. No polling, overlap, resolver write, dependency or Sprint 1 feature. Local validate passes with 35 tests/four files, 97.95% statements, 98.36% branches, 100% functions/lines; official elevated lint retry passes. Simulated light/dark token compatibility passes, actual installed theme comparison unverified. Proposed Sprint 5 visual deferral awaits explicit owner disposition. Deployment/installed diagnostics/Console/log confirmation, new PR CI, protected merge/main sync/post-merge CI remain pending and are recorded in the acceptance report as observed. LH-014 remains open, accepted only for isolated development; production security blocked. No new sprint.

Owner approves moving the unavailable installed host-theme comparison to Sprint 5. Carry forward as an unverified visual acceptance item, not a foundation pass. No Sprint 5 implementation starts now. Runtime diagnostic/Console/log, final PR CI and conditional protected merge remain outstanding.

Focused development deployment **2.1.0** succeeded; initial timeout/history verification recorded in audit. Owner has installed diagnostic/Console instructions; runtime confirmation pending. No staging/production deployment or next sprint.

Implementation 5843382 pushed, PR #1 updated; required Validate run 45778629516 passed. History confirms 2.1.0 development success 07:51:19Z and post-deploy major-2/up-to-date installation. No upgrade. Owner diagnostics/Console and matched post-deployment logs remain pending; no merge or Sprint 1 readiness claim. Main stays ff2939c.

Owner installed diagnostic acceptance received: Passed/Resolved/available/Valid, correct metadata/not-configured integrations and valid UUIDv4. Exact supplied correlation independently matched to development backend.status/success at 2026-11-26T08:00:25.634Z. Installed light/dark visual comparison explicitly deferred to Sprint 5 as unverified. Console review result still pending; final-head CI/protected merge/main sync/post-merge CI remain required. LH-014 open/development-only; no new sprint.

Final Console disposition: owner-controlled stable-connection/refresh/scoped Light House iframe retry passes with no app iframe errors. LH-013 runtime acceptance satisfied with owner-approved Sprint 5 visual deferral. Prior host/network warnings recorded without raw private identifiers. Foundation may proceed through final-head CI/protected PR #1 merge/main sync/post-merge CI under existing owner authorisation. Sprint 1 is prepared, not started; next sprint requires owner initiation and its own prerequisite decisions.

## Sprint 1 current boundary

The owner explicitly assigned Sprint 1. Baseline PR #1 is merged; post-merge run 45780524271 passed at cc82f504. Earlier foundation pending entries describe historical checkpoints, not current blockers. Sprint 1 requires its own live SQL, isolation, CI, review and authorised merge gates. Sprint 2 has not started.

## Sprint 1 independent readiness review — 2026-11-26

[Decision package](sprint-1-readiness-review.md) independently reproduces baseline/83 tests/coverage, lint approval gate and exact advisory delta. No confirmed exploitable application defect established; no implementation/dependency/permission edit justified. LH-014 remains open with a specific renewed development-only recommendation awaiting owner decision. LH-101/LH-102 remain locally implemented with live acceptance incomplete. Sixteen first-installation checks and a separately authorised genuine second-installation procedure are prepared; two logical tenants do not satisfy installation isolation. No Sprint 2, deployment/install/migration/push/PR/merge occurred. Main remains preserved at cc82f504. Review changes are uncommitted pending handover; no commit was requested.

## Authorised Sprint 1 execution — 2026-11-26

Owner authorisation now covers the reviewed development dependency exception, deployment/major upgrade/SQL migrations and synthetic acceptance, Sprint 1 branch publication/PR/CI. LH-014 stays open for five high/six moderate findings in the exact reviewed tree; staging/production blocked. LH-101/LH-102 runtime acceptance remains incomplete until actual evidence is recorded. Second installation and merge remain separately gated. Earlier pending-authorisation wording is historical and superseded by this entry; Sprint 2 has not started.

Development platform update: official lint passes, deploy 3.0.0 succeeds and existing Jira development installation is independently confirmed major 3/up-to-date. Native SQL/installed behaviour remain pending owner UI execution and backend verification; second installation and merge remain blocked.

Publication/CI update: draft PR #2 exists, Validate run 45804050905 passed on 3926d38; protected main requires strict validate. Native acceptance and genuine second-installation evidence still block completion/merge; no next sprint started.

## LH-101 read-only diagnostic preparation — 2026-11-26

The latest request authorises a fixed development-only Jira-administrator diagnostic if Console cannot show checkpoint names/metadata. Implemented locally via the existing inventory resolver and a manual button: expected/actual/missing known names, redacted unexpected-name count, readiness presence/value, environment, version/type and sanitised list/query errors. No schema/readiness/tenant/inventory writes or arbitrary SQL/context arguments. Mocked boundary/contract/UI checks pass; live tunnel/native result pending. Existing migration/bootstrap/seed hold remains. New deployment and remote publication are not performed; fallback changes and owner-run tunnel are documented in the live runbook. LH-101/LH-102 and Sprint 1 remain incomplete; no Sprint 2.

## LH-101/LH-102 controlled diagnostic deployment — 2026-11-26

Owner-authorised existing-development-only diagnostics deployed successfully as 3.1.0 (official history 2026-11-26T18:37:51.579Z); same single Jira installation remains major 3 (Latest), Up-to-date without upgrade. All 115 tests/13 files, local validation and official lint pass; manifest/scopes/permissions/egress/dependencies/migrations unchanged. Exact reviewed changeset and official package evidence in audit.md. Fresh sanitised invocation category/code and correlation capture remains pending because browser host is unavailable; exact manual controls in live runbook. Runtime/root-cause/inventory acceptance remain open. No database mutation, additional installation, production, publication, merge or Sprint 2; unresolved LH-014 remains accepted for development/synthetic-only use.

Latest owner capture uses pre-3.1.0 generic rejection wording, with no category/time/valid UUID. Submitted UI resource comparison confirms wording mismatch, so this is not verified execution of the new rejection path. Establish fresh DEVELOPMENT UI delivery using the live-runbook private-session step; hosted root cause and inventory acceptance remain open. No further deployment or database action.

## Current bounded diagnostic investigation — 2026-11-26

The new owner request supersedes the LH-101/LH-102 text above that forbids further deployment: a controlled diagnostic-only DEVELOPMENT deployment is now authorised after required engineering gates. No data mutation, additional installation, tunnel restart or functional SQL correction is authorised. Lifecycle instrumentation is deployed to DEVELOPMENT as 3.2.0; hosted history Success at 2026-11-26T19:25:30.461Z. Same existing Jira installation remains major 3 (Latest), Up-to-date. All 124 tests pass, preserving the existing 117 cases plus seven new cases. Hosted log retrieval since deployment returns no events; fresh owner Load inventory UUID/UTC capture is pending because browser access is unavailable. Official Forge lint retry passes (secure-login escalation; prior timeout remains historical). Runtime attribution, LIMIT compatibility and persisted-state baseline are still open; do not mark LH-101/LH-102 complete or start Sprint 2. See the latest audit/investigation entries for deployment and native acceptance status.

## DEVELOPMENT 3.2.0 UUID attribution — 2026-11-26

Supplied inventory UUID 878d3b6f-6fec-4e2d-bb07-829509844583 is traced: first failure inventory.sql at 19:29:19.693Z, SQL_ERROR / SQL_EXECUTION_ERROR / ER_WRONG_ARGUMENTS. Readiness, membership, authorisation, parameters and query construction succeed; mapping/response stages are not reached. resolver.completion repeats the original failure. Health UUID 895938f9-2eff-4e56-8d47-7a3c0265dd2b independently matches success at 19:28:18.546Z. This supersedes pending-UUID/unknown-stage instructions above. LIMIT binding is the leading source-based diagnosis, not conclusively distinguished from another argument defect inside the SELECT/driver. Proposed safe-integer 1–51 literal LIMIT with bound tenant/cursor and unchanged paging/security is documented for review, not implemented or deployed. No mutation or repeated UI test; persisted baseline and remaining native gates remain open. See [investigation](../operations/sprint-1-inventory-investigation.md).

## LH-101/LH-102 pagination correction checkpoint — 2026-11-26

Owner authorised bounded LIMIT correction and conditional existing DEVELOPMENT deployment. Implemented locally across shared eleven-kind list query; regression additions unexecuted. **Stopped: required typecheck TS2345 in new diagnostic test spy; no deployment.** Lint/format passed; tests/coverage/build not reached; official Forge lint blocked by sandbox credential-store access. Audits retain eleven accepted-development-only findings. Last verified hosted version remains 3.2.0; native diagnosis/persisted rows and Sprint 1 acceptance remain open. See investigation/audit for exact results and read-only UI acceptance. Earlier no-correction-authorisation wording is superseded; no merge or Sprint 2.

## Resumed bounded LIMIT engineering gates — 2026-11-26

Supersedes the preceding stopped-at-TS2345 checkpoint and stale no-functional-deployment wording: owner explicitly directs safe defect remediation and retains controlled correction deployment authorisation. Test diagnostic now preserves run<T> using a wrapper plus separate stage spy; production interfaces/compiler settings unchanged. All 148 tests pass, retaining the existing 124 plus 24 new regressions; npm run validate and official Forge lint pass. Fresh-cache audits retain the accepted eleven findings/three advisory roots and unchanged dependency tree. All eleven inventory kinds preserve bounded decimal LIMIT, tenant/cursor bindings, ordering/lookahead/isolation and structured diagnostics. Deployment/postflight and native capture results are recorded in the subsequent investigation/audit entry. Browser host unavailable; LH-101/LH-102 and native ER_WRONG_ARGUMENTS diagnosis remain incomplete pending hosted evidence. No Sprint 2.

## Bounded LIMIT correction deployed — 2026-11-26

Generic test diagnostic now preserves run<T> with a separate typed stage spy; no production interface/compiler weakening or regression removal. npm run validate passes all 148 tests (existing 124 plus 24 new), coverage 97.03% statements/96.57% branches/100% functions/98.03% lines, production build and local manifest checks. Official Forge lint retry passes; prior sandbox/timeout failures are separate external failures. Fresh-cache audits retain eleven known findings (5 high/6 moderate) under exact-tree DEVELOPMENT-only disposition. All eleven kinds retain tenant/cursor bindings, deterministic keyset/lookahead, isolation and diagnostics with safe-integer 1–51 decimal LIMIT. Dependencies/permissions/migrations/egress/app identity unchanged.

Authorised attributed DEVELOPMENT deployment succeeds as **3.3.0**, hosted history **2026-11-26T19:43:47.949Z**. Existing Jira installation remains major 3 Latest/Up-to-date and exactly matches preflight; no installation mutation. Version compatibility metadata unchanged. Deployment acceptance is separate from native acceptance. Browser host unavailable; exact sites/carriers/sla_tiers actions and UTC/outcome request sent to owner. No fresh native correlation-linked result at this checkpoint; ER_WRONG_ARGUMENTS diagnosis remains provisional. No tunnel/database mutation, merge or Sprint 2. See latest audit/investigation for exact commands, hashes, changed files and evidence limits.

## Reusable automated native acceptance infrastructure — 2026-11-26

Implemented isolated TypeScript/Playwright e2e workspace and root test:e2e:auth, test:e2e:development, test:e2e:development:headed, test:e2e:report, test:e2e:check and test:e2e:fixture commands. Pinned development-only tooling has its own lock/audit (zero findings), no Forge runtime/dependency/permission/migration/egress changes. Owner interactive Atlassian login/MFA stores a private ignored session; the suite automates only health, ready-v1 overview, approved ISP selection and sites/carriers/sla_tiers plus available next pages. Fresh rendered transitions, real row counts/fields/lifecycle/version, empty-success distinction, bounded ordering/duplicate checks, fixed errors and UTC durations feed curated private JSON/escaped HTML and terminal summaries. Hosted CLI diagnostics distinguish displayed UUID matches from temporal candidates/ambiguous/unmatched evidence. No screenshots/traces/raw browser/network/error dumps or mutation clicks. CI runs credential-free logic tests; local synthetic Chromium fixture passes and is not native acceptance.

Current hosted run is blocked at AUTH_REQUIRED with reports produced and no app invocation; headed browser probe is sandbox-restricted. Owner desktop first-use commands in e2e/README.md replace manual per-inventory repetition. Local application validation retains all 148 tests and coverage/build; harness logic tests pass (8). Official Forge lint retry passes; prior timeout remains failed external evidence. Root audits retain eleven known findings under existing DEVELOPMENT-only disposition. DEVELOPMENT remains 3.3.0; no new deployment, installation, SQL/tunnel mutation, merge or Sprint 2. Native LIMIT diagnosis and other Sprint 1 acceptance gates remain open. See latest audit for exact commands/results.

Final CLI-format refinement: actual grouped hosted logs carry time-only UTC prefixes. Parser now reconstructs dates only from a unique bounded query interval and labels provenance; ambiguous dates are rejected. Nine credential-free harness checks pass, including midnight/multiple-date cases. Safe projection reproduced the 22 events and SQL_EXECUTION_ERROR/ER_WRONG_ARGUMENTS stages of the historical DEVELOPMENT 3.2.0 UUID, not a fresh 3.3.0 invocation. No native correction success inferred.

## Authentication correction checkpoint — 2026-11-26

Authentication CLI now reports the actual failing stage via fixed safe categories; local-only `test:e2e:doctor` checks desktop/browser/storage prerequisites. Private-directory mkdir now preserves OS error codes internally for permission categorisation. Corrected Ubuntu commands/remedies are in E2E README and live runbook. Owner's previous failure cause remains unverified until the corrected doctor runs there; desktop login/MFA and fresh hosted inventory acceptance remain open. No Sprint 2 or hosted mutation.

## Browser compatibility correction — 2026-11-26

Implemented shared sandboxed launch configuration with Chrome Stable default and explicit Chromium selection for doctor, interactive authentication, both hosted modes and synthetic fixture; six new regression tests preserve the original 14 harness tests. Downloaded Chromium startup failure is now confirmed owner evidence, superseding the earlier unknown-cause checkpoint. Local test/build results and desktop/native limits are in audit.md. LH-101/LH-102 native acceptance stays open; no Sprint 2. LH-014 audit investigation reproduces 17 default-cache versus 11 fresh-cache findings on the unchanged lock, with identical three advisory roots and six additional inherited ProseMirror entries; no remediation claimed.

## Current Sprint 1 continuation — 2026-11-26

Three-kind native SQL correction functional acceptance and five-record persistence are accepted. LH-101/LH-102 remain incomplete for the separately enumerated native gates. The [consolidated completion plan](sprint-1-execution-report.md#consolidated-sprint-1-completion-plan--2026-11-26) is authoritative over historical pending-UUID, unknown-persistence and browser-launch next actions below/above. Preserve harness and current branch ancestry; no mutation, deployment, tunnel, publication, merge or Sprint 2 in this handoff.

## Phase A customers investigation — 2026-11-27

LH-101/LH-102 remain incomplete. Owner reports two customers Bridge rejections (unclassified, then TypeError after hard refresh); ready v1/all fifteen migrations/admin membership/ISP v2 remain available. Four kinds reportedly pass; fourth kind/counts not yet identified in this update. Exact health UUID matches 05:13:07.217Z. Two nearby complete hosted list lifecycles have successful SQL/mapping/serialization/completion but remain entity-unmatched without click intervals. No SQL defect or customer backend completion established. Local comparison finds one scalar payload/resolver/response path across eleven kinds; three new mock-Bridge regressions pass. Owner continues remaining read-only kinds; no deployment, mutation, repeated accepted checks or Sprint 2. See [investigation](../operations/sprint-1-inventory-investigation.md#phase-a-customers-bridge-rejection-investigation--2026-11-27).

## Bounded Phase B approved; prerequisite hold — 2026-11-27 (current)

Owner-approved bounded Phase B is conditional; execution is BLOCKED before mutations. Codex browser inventory returned no apps/browsers and host unavailable. Fresh development usage, tenant/row pending state, receipt evidence, consenting V/O identities/contexts and cumulative SQL headroom remain unverified. No Phase B native action, unsuccessful mutation or deployment occurred; these are inaccessible evidence/prerequisite gaps, not application failures.

LH-101/LH-102 remain incomplete. Owner approved the single bounded session, with all five prerequisites global before any mutation. [Cloud Browser executor prompt](../operations/sprint-1-live-acceptance.md#self-contained-cloud-browser-execution-prompt--2026-11-27) is ready; no individual app clicks requested of the owner. Current task is access/evidence/identity preflight, not further blanket authorisation. Prior native eleven-kind baseline and historical TypeError uncertainty are preserved. No new runtime exercise attempted, no deployment, merge or Sprint2.

## Authenticated Phase B prerequisite checkpoint — 2026-11-27 (current)

Owner approved Phase B conditionally; all mutations held because applicable V/O test identities and consent remain unverified (owner unsure). Authenticated Console now accessible: existing DEVELOPMENT 3.3.0 Latest confirmed; fresh displayed SQL requests 286, SQL compute 0.006 hours/storage 0 GB-hours, Functions 30.2469 GB-seconds/logs 0.0005 GB; current/forecast $0, November 1–27. Up-to-one-hour usage lag means 286+2,000<=5,000 is conditional planning arithmetic, not a verified remaining bound. Lantern tenant v2 pending null; existing repair probe v1 pending null and one matching receipt among five visible receipts. Partial samples do not prove exhaustive clean state/receipt uniqueness. Recovery fault path NOT EXERCISED; all Phase B functional exercises BLOCKED / NOT RUN. No mutation/deploy/tunnel/production/new installation/publication/merge/Sprint 2. Prior native baseline preserved. Full evidence, UTC observations, limitations and browser instructions are in the latest live-acceptance checkpoint and execution report. Consent must be explicitly supplied through private identity mapping; no account creation is inferred.

## Phase B.1 / B.2 independent prerequisite proposal — 2026-11-27 (current)

LH-101/LH-102 incomplete. B.1 administrator functional work can be separated from B.2 consenting-identity authorisation work without waiving acceptance criteria. Revised gates/prompts ready in live runbook, owner review/authorisation required before ANY mutations. Recorded SQL286 and one-hour lag reconciled conditionally; proposed1,750/250 share existing2,000 additional/5,000 cumulative cap, no reset. Probe clean, recovery NOT EXERCISED; RBAC/expiry/foreign-user access/installation isolation and partial migration retry/concurrency remain open. No new native operations or code/dependency/deployment changes.

## Owner-approved Sprint1 checkpoint and LH-103 start — 2026-11-27

ADR-0017 accepted. Sprint1 status: **IMPLEMENTATION-COMPLETE LOCALLY — RELEASE ACCEPTANCE OUTSTANDING**. Owner authorises local reproducible checkpoint commit and isolated Sprint2 LH-103 implementation. Final native R-01–R-14, LH-014 security disposition, licence, release/installation gates remain open. No merge/protection bypass, deployment, new installation or hosted mutation authority is implied. PR2 published ddf0d9d/run45804565939 remains historical until a separately authorised exact-head publication/CI.

Privacy checkpoint removes private site/environment target strings from publication candidates and keeps the exact approved target in ignored owner-only e2e/.local/approved-target.json. Hosted auth/run fails closed without that config; no URL override or session inspection. All151 application tests and20 harness checks retained; added target-input negatives inside existing harness check. Exact local checkpoint SHA recorded after creation in the subsequent audit/handover. LH-103 remains local-only and its release evidence will be distinct from implemented functionality.
