# ADR-0020 — Durable operational commands and explicit catch-up

Date:2026-11-28. Status: implemented local defaults; native/release acceptance outstanding. Owner-approved requirements remain explicit accountability, accepted handoffs/returns, continuous SLA and guarded closure. Timing, checklist and SQL representation below are proposed implementation defaults, not universal ISP policy or hosted acceptance.

## Catch-up and incident authority

The durable mapped monitoring inbox is the explicit recovery ledger. An authorised administrator scans at most20 ready receipts with a21st-row sentinel and keyset cursor. All ready receipts are eligible, including existing evidence/incident/JSM intents; evidence existence alone is not proof downstream completed. Reprocessing uses the original immutable incident and JSM intent uniqueness/lease rules. Individual fixed failures and missing schema/configuration states are returned, never disguised as empty success. Cursor advances after attempted failures; those remain durable and separately actionable. No automatic polling or guaranteed eventual scheduler is claimed. Costs are additional to the prior webhook plan and need separate bounded native approval.

A unique durable original problem, agreeing with the incident's source/problem/start/site/uplink, anchors its resource identity. Current mismatched resource/site/uplink recovery or update conflicts after durable retention. Stored mismatches cannot contribute recovery/update counts or poison subsequent valid evidence. Missing/ambiguous original authority fails closed. Recovery does not alter operational state or SLA. JSM request descriptions now contain safe infrastructure references and separate confirmed/potential customer/service counts and confidence, without customer identities/raw payloads.

## Operational state and accountability

Immutable enrichment/SLA remains in incidents; mutable workflow is a separate installation/tenant aggregate. v005 adds readiness/checkpoints, state, command receipts, audit, handoff history, gates and NOC configuration. Each state change CAS atomically includes a pending receipt/audit envelope. Deterministically keyed projections must match immutable contents before the matching envelope clears. A receipt is not returned as complete while projections remain pending; a later different command is blocked. No multi-statement transaction or silent audit eviction is assumed.

Server authority derives current tenant role, mapped active engineer, active same-tenant team, grant/team expiry and configured NOC from stored Atlassian identity. Final mutations repeat relevant parent/team/engineer/tier/configuration/facts predicates. Replays recheck membership in the stored original command's team and bind exact account/team/content fingerprints. Queue ownership has no assigned engineer until acknowledgement; acceptance assigns the receiving engineer. Requests/rejections retain the accountable team/engineer. Subsequent owner commands require the responsible engineer; explicit reassignment remains an open implementation task, not an admin bypass.

Departments request return without transferring ownership. Configured NOC explicitly accepts/rejects; only acceptance transfers ownership/engineer and enters restoration validation. Original NOC identity and SLA snapshot remain pinned. A changed NOC configuration cannot silently reroute an existing incident.

## Checklists and closure

Stored operator attestations use code-defined operational/remediation/restoration/closure templates, exact required bounded fields and literal booleans. Their server-generated IDs/timestamps bind operation revision and evidence revision, with a proposed five-minute lifetime. They do not establish native Jira permissions. Fresh operational checks also apply at handoff acceptance. Evidence count (including conflicts) invalidates stale checks; only correctly bound recoveries become restoration evidence. Final SQL checks facts revision and nondecreasing logical command/checklist timestamps.

Resolve/close additionally require exact durable verified native transition evidence, linked issue identity, expected operation/gate/version and confirmation time. The current concrete reader intentionally returnsnull, so these actions remain NOT_READY and UI-disabled. Monitoring recovery, a checkbox or a client issue ID can never grant closure. Native Jira bypass enforcement and transition writer remain mandatory future integration/native gates.

An administrator may perform projection-only repair of an already committed envelope if its original actor is later revoked. The boundary selects the stored command, preserving original attribution; it never reruns the business transition, invents an actor or clears an unexplained lease. Local failure/repair and clock rollback tests do not establish native Forge SQL semantics.

References: [ADR-0015](ADR-0015-operational-workflow-mental-model.md), [ADR-0016](ADR-0016-sprint-1-persistence-and-repair.md), [ADR-0017](ADR-0017-development-progression-and-release-acceptance.md), [ADR-0019](ADR-0019-local-incident-orchestration.md). Existing official Forge prepared-SQL/async references were checked2026-11-27; no new platform transaction capability is asserted. Forge/ADS MCP remain unavailable in this environment.
