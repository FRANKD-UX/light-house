# Engineering backlog

Updated 2026-11-26 (Sprint 0.6). P0 critical path/security; P1 planned supporting delivery; P3 stretch. “Documented” is design completion, not implemented functionality. Sprint 0 local evidence and external gates are recorded separately in audit and acceptance criteria. No Sprint 1 implementation has begun.

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
- Known blockers: Genuine app.id now present; official lint credential-store access and installed runtime remain pending.

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
- Status: Registration owner-completed; CLI credential-store blocker and deployment authorisation/runtime gates pending
- Verification evidence: Owner registration and genuine manifest ID preserved; Sprint 0.6 official lint exits 1 on credential-store access, no deploy/runtime test claimed. See operations/deployment.md.
- Known blockers: Codex environment credential-store access, owner confirmation of development site, LH-014 disposition and deployment/install authorisation.

## LH-014 — Forge SDK dependency advisory review

- Sprint: 0 follow-up / release gate
- Description: Remediate or explicitly assess current Forge Bridge transitive ProseMirror/glob/minimatch advisories before release.
- Priority: P0 before deployment/release
- Dependencies: LH-009
- Acceptance criteria: Review current official upstream fixes and compatibility; deterministic install, audit and behaviour/build checks after any change; document residual exposure and owner disposition.
- Status: Assessed — upstream affected tree remains; deployment/release gate open
- Verification evidence: Sprint 0.5 full and production audits exit 1: 8 affected packages, 5 high/3 moderate. Per-package paths/ranges/patches and local bundle reachability are recorded in dependency-security-assessment.md; vulnerable leaves absent from current emitted app graphs. Official Forge artifact remains unverified.
- Known blockers: Current SDK tree pins affected components; suggested Bridge major downgrade and transitive overrides are not verified remedies. No force fix applied.

## LH-101 — Tenancy and Forge-native persistence

- Sprint: 1
- Description: Implement migration readiness, tenant membership and inventory repositories with same-tenant references/optimistic writes; validate bounded mutation-envelope repair primitive without building the full future schema.
- Priority: P0
- Dependencies: LH-013,LH-004,LH-007
- Acceptance criteria: Real SQL migrate/retry tests; two-tenant and two-installation denial tests; parameterised operations.
- Status: Not started
- Verification evidence: Design in tenancy/persistence/data-model.
- Known blockers: Registered app present; site/runtime acceptance and proposed persistence defaults still pending.

## LH-102 — Synthetic ISP inventory

- Sprint: 1
- Description: Implement sites/carriers/uplinks/customers/customer services/basic teams/manual engineer references and uplink service dependencies with synthetic seed; defer directory adapters and full admin UI to Sprint 6.
- Priority: P0
- Dependencies: LH-101
- Acceptance criteria: Multi-site inventory, primary/backup relationships, validated references and distinct service identities.
- Status: Not started
- Verification evidence: Data-model/demo designs only.
- Known blockers: Persistence and approved impact simplification.

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

LH-013 official lint/runtime and LH-014 security disposition → LH-101 → LH-102 → LH-103 → LH-104 → LH-105 → LH-106 → LH-108 → LH-109 → LH-110. Identity adapter work has independent provider consent risk; manual fallback is essential. LH-190 never blocks this path. See roadmap.md for minimum submission versus optional production enhancements and risk-register.md for schedule pressure.

Next action is owner review of proposed ADRs and official lint/runtime gate, not an automatic start of Sprint 1. All local quality results must be read from audit; no mocked test is credited as runtime validation.

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
