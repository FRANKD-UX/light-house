# Engineering backlog

Updated 2026-11-24. P0 critical path/security; P1 planned supporting delivery; P3 stretch. “Documented” is design completion, not implemented functionality. Sprint 0 local evidence and external gates are recorded separately in audit and acceptance criteria. No Sprint 1 implementation has begun.

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
- Status: Implemented locally; Forge gate pending
- Verification evidence: src/, static/app/, tests/unit/, manifest.yml.
- Known blockers: Real app.id and installed runtime absent.

## LH-009 — Quality gates and CI

- Sprint: 0
- Description: Configure strict TS, ESLint, Prettier, Vitest coverage, deterministic install/build, no-deploy CI.
- Priority: P0
- Dependencies: LH-008
- Acceptance criteria: Applicable local validation passes; CI on PR/main; failures visible.
- Status: Verified locally — aggregate validate exit 0
- Verification evidence: package scripts, lockfile, CI workflow; npm ci and validate pass, 10 tests/0 failures; audit.
- Known blockers: Remote CI cannot execute without remote/push authorisation.

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
- Status: Blocked — owner credentials/authorisation
- Verification evidence: No registration/deploy/runtime test claimed; operations/deployment.md has exact commands.
- Known blockers: Interactive Atlassian owner authentication, development site and deployment authorisation.

## LH-014 — Forge SDK dependency advisory review

- Sprint: 0 follow-up / release gate
- Description: Remediate or explicitly assess current Forge Bridge transitive ProseMirror/glob/minimatch advisories before release.
- Priority: P0 before deployment/release
- Dependencies: LH-009
- Acceptance criteria: Review current official upstream fixes and compatibility; deterministic install, audit and behaviour/build checks after any change; document residual exposure and owner disposition.
- Status: Open — upstream affected tree remains
- Verification evidence: Final npm audit reports 8 affected packages, 5 high and 3 moderate, no critical. Current shell has no editor/paste UI. Full security review is not claimed.
- Known blockers: Current SDK tree pins affected components; suggested Bridge major downgrade and transitive overrides are not verified remedies. No force fix applied.

## LH-101 — Tenancy and Forge-native persistence

- Sprint: 1
- Description: Implement migration readiness, tenant membership and repositories with same-tenant references/optimistic writes.
- Priority: P0
- Dependencies: LH-013,LH-004,LH-007
- Acceptance criteria: Real SQL migrate/retry tests; two-tenant and two-installation denial tests; parameterised operations.
- Status: Not started
- Verification evidence: Design in tenancy/persistence/data-model.
- Known blockers: Registered app/site; review proposed persistence defaults.

## LH-102 — Synthetic ISP inventory

- Sprint: 1
- Description: Implement sites/carriers/uplinks/customers/teams and explicit dependencies with synthetic seed.
- Priority: P0
- Dependencies: LH-101
- Acceptance criteria: Multi-site inventory, primary/backup relationships, validated references and distinct service identities.
- Status: Not started
- Verification evidence: Data-model/demo designs only.
- Known blockers: Persistence and approved impact simplification.

## LH-103 — Authenticated Zabbix ingestion

- Sprint: 2
- Description: Implement source credentials/rotation, adapter validation, stable event inbox and async dispatch.
- Priority: P0
- Dependencies: LH-101,LH-102
- Acceptance criteria: Pinned source version; wrong/replayed/oversized/tenant-spoof payload denied; duplicates one receipt; queue gap repair.
- Status: Not started
- Verification evidence: Adapter contract and zabbix/security design.
- Known blockers: Live ingress and auth parameter review.

## LH-104 — Incident enrichment and SLA engine

- Sprint: 3
- Description: Calculate known/unknown distinct impact and effective ISP P1/P2/P3 snapshots.
- Priority: P0
- Dependencies: LH-102,LH-103,LH-006
- Acceptance criteria: Deterministic UTC boundary tests; policy changes affect new incidents; unknown/failover scenarios explicit.
- Status: Not started
- Verification evidence: SLA and lifecycle designs.
- Known blockers: Owner ADR-0009 assumptions.

## LH-105 — Actual JSM lifecycle and notifications

- Sprint: 4
- Description: Create real requests, reconcile ambiguous outcomes, process recovery/manual resolution/reopen and native notification fields/rules.
- Priority: P0
- Dependencies: LH-104,LH-005
- Acceptance criteria: Actual issue key, one issue under duplicate/concurrency, timeout reconciliation, recovery and recipient evidence.
- Status: Not started
- Verification evidence: JSM integration/event lifecycle designs only.
- Known blockers: Site project/request-type/field/workflow/recipient configuration.

## LH-106 — NOC dashboard and administration

- Sprint: 5
- Description: Expose incident context/deadlines/retries and admin source/inventory/SLA configuration with backend authorisation.
- Priority: P0
- Dependencies: LH-105
- Acceptance criteria: Honest live states, tenant-isolated views, keyboard/theme checks, forged admin invokes denied.
- Status: Not started
- Verification evidence: Sprint 0 shell only.
- Known blockers: Lifecycle data and permissions.

## LH-107 — Directory adapters and manual mapping

- Sprint: 6
- Description: Implement Entra ID, Google Workspace and always-available reviewed manual identity mapping.
- Priority: P1
- Dependencies: LH-101,LH-106
- Acceptance criteria: Provider consent/revocation, ambiguity/disabled subject tests; no replacement login or automatic role grants.
- Status: Not started
- Verification evidence: Identity/integration designs; provider details unverified.
- Known blockers: Owner provider consent and current REST capability verification.

## LH-108 — Security and reliability regression

- Sprint: 7
- Description: Execute threat-driven failure, tenant, auth, rate and dependency/browser regression matrix.
- Priority: P0
- Dependencies: LH-103,LH-105,LH-106
- Acceptance criteria: Cross-tenant/auth/ambiguous-create tests pass, audit findings resolved or explicitly accepted before release.
- Status: Not started
- Verification evidence: Regression matrix and threat model.
- Known blockers: Implemented flows and live environment.

## LH-109 — Release and judge installation readiness

- Sprint: 8
- Description: Prepare release candidate, owner-authorised deployment/sharing, install instructions and fresh-site verification.
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

LH-013 → LH-101 → LH-102 → LH-103 → LH-104 → LH-105 → LH-106 → LH-108 → LH-109 → LH-110. Identity adapter work has independent provider consent risk; manual fallback is essential. LH-190 never blocks this path. See roadmap.md for minimum submission versus optional production enhancements and risk-register.md for schedule pressure.

Next action is owner review of proposed ADRs and registration/runtime gate, not an automatic start of Sprint 1. All local quality results must be read from audit; no mocked test is credited as runtime validation.
