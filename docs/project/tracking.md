# Engineering backlog

Updated 2026-11-26 (explicitly authorised Sprint 1 implementation). P0 critical path/security; P1 planned supporting delivery; P3 stretch. “Documented” is design completion, not implemented functionality. Sprint 0 local evidence and external gates are recorded separately in audit and acceptance criteria. Current Sprint 1 evidence supersedes historical foundation blockers; see sprint-1-execution-report.md.

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
- Verification evidence: Sprint 0.5 full and production audits exit 1: 8 affected packages, 5 high/3 moderate. Per-package paths/ranges/patches and local bundle reachability are recorded in dependency-security-assessment.md; vulnerable leaves absent from current emitted app graphs. Official Forge artifact remains unverified.
- Known blockers: Current SDK tree pins affected components; suggested Bridge major downgrade and transitive overrides are not verified remedies. No force fix applied.

## LH-101 — Tenancy and Forge-native persistence

- Sprint: 1
- Description: Forge SQL schema/readiness, server-authoritative membership, tenant-scoped repositories, optimistic writes and bounded durable tenant/aggregate repair.
- Priority: P0
- Dependencies: Accepted foundation cc82f504; LH-004,LH-007.
- Acceptance criteria: Real SQL migrate/retry; two-tenant/two-installation denial; parameterised operations; durable repair.
- Status: Implemented locally; acceptance incomplete.
- Verification evidence: Executable repositories, application/resolver/UI paths, local relational simulation and mock-SDK tests; Sprint 1 execution/security reports.
- Known blockers: Official lint MAJOR_VERSION_RULE approval; explicit deployment/SQL upgrade consent and reassessed dependency-risk disposition; live SQL and actual second-installation evidence; publication/CI/review/merge authorisation. Foundation is accepted, not reopened.

## LH-102 — Synthetic ISP inventory

- Sprint: 1
- Description: Sites, carriers, uplinks, synthetic customers, independent services/dependencies, basic teams/manual engineers, demonstration policy configuration and bounded idempotent seed.
- Priority: P0
- Dependencies: LH-101.
- Acceptance criteria: Multi-site primary/backup inventory, same-tenant/lifecycle validation and distinct service identities.
- Status: Implemented locally; live persistence acceptance incomplete.
- Verification evidence: Eleven inventory entity kinds, two-ISP fixtures, UI operations, negative/security and retry/concurrency tests.
- Known blockers: Installed SQL acceptance and remote review gates. Impact algorithm and operational policy selection remain later work, not Sprint 1 prerequisites to local inventory implementation.

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
