# Deterministic SLA policy design

Design only; no engine in Sprint 0. Proposed 24/7 elapsed-time model requires owner review under ADR-0009. Priorities P1, P2 and P3 have ISP/tier-specific positive integer deadline durations, configurable warning offsets and explicit source severity/impact priority mapping. Synthetic examples (not contracts): P1 60 minutes/warn 45 minutes, P2 240/warn 180, P3 1440/warn 1080 after start.

A published policy version has effective-from UTC, optional exclusive effective-until, priority mapping, each duration/warning offset, unknown-impact rule and publication actor. Reject overlaps, gaps without a declared fallback, unknown priorities, nonfinite/negative durations and warnings outside `0 <= warningOffset < deadlineDuration`. Once published, create a new version instead of editing it.

Select the published policy effective at the validated source problem occurrence time, not delivery time. Record received time separately and quarantine implausible timestamps; owner review is needed for the allowed clock skew/age. For an incident spanning several customer tiers, select the strictest applicable deadline and retain the selected tiers and decision reason; tie-break by stable priority/tier ID. Unknown impact uses an explicitly configured conservative policy or manual review, never assumed P3. Priority mapping must be deterministic and explainable.

Snapshot policy version, input severity/impact confidence, selected priority/tier, source start UTC, deadline duration, warning offset, warningAt and deadlineAt on the incident. UTC epoch arithmetic: `deadlineAt = start + durationSeconds * 1000`; `warningAt = start + warningOffsetSeconds * 1000`. Future policy/configuration changes affect subsequent incidents only. Recovery detection does not automatically stop the clock; confirmed resolution time does, unless a separately documented future pause model is approved.

Status: on-track before warningAt, warning from warningAt to deadlineAt, breached at or after deadlineAt while unresolved. On resolution preserve whether resolutionAt exceeded deadlineAt and the original warning/breach history. Equality at deadline is breached; reopen creates a separate cycle with an explicit start rule and immutable previous cycle. Inject a clock in implementing tests, never use workstation timezone or wall clock in pure policy logic.

## Four independent concepts

| Concept                          | Owner and integration                                                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Light House operational deadline | App-owned UTC snapshot, visible in dashboard and JSM custom datetime field.                                                      |
| Light House warning threshold    | App-owned warningAt/status; dashboard derives current status from UTC, scheduled sweep persists/report changes eventually.       |
| Native JSM SLA metric            | JSM-owned configured metric; GET request SLA API can read its progress. App deadline fields do not create or modify this metric. |
| JSM calendar/workflow            | Admin-configured start/pause/stop conditions, calendars and goal filters; may differ from the app 24/7 clock.                    |

Sprint 4 installation checklist maps priority, operational deadline, warningAt, policy version and state to real field IDs and documents the native metric/calendar. Compare the metric response and app snapshot and expose divergence with last reconciliation time/reason; do not silently overwrite either authority. No verified public native SLA goal-write API is assumed.

Warnings/breaches appear in the NOC view and JSM fields. A bounded five-minute scheduled sweep checks due active incidents, uses conditional state claims and writes each warning/breach marker once. Delayed schedules mean eventual notification, not delivery at the exact timestamp. JSM automation can react to field changes or a configured native SLA threshold and generate approved internal/public workflow activity through native notifications. Verify rule quotas, recipient configuration and notification logs on the target site; none is configured yet. No external email service or Graph email is introduced.

Required future tests: P1/P2/P3 per tenant, effective boundary selection, leap-day/UTC arithmetic, warning/deadline equality, historical snapshot immutability, unknown impact, invalid policy, overlapping publication concurrency, outage delivery delays, multi-tier impact, recovery versus resolution and reopen cycles. References: [capability assessment](../project/forge-capability-assessment.md), verified 2026-11-24.

## Continuous ownership accountability — Sprint 0.5

The owner requires configurable ISP-specific P1/P2/P3 deadlines/warnings and immutable historical snapshots. Changing engineer, requesting/accepting/rejecting a handoff, departmental remediation, return to NOC and validation never resets or pauses the overall incident clock. Audit ownership intervals against the same SLA cycle. Each handoff copies policy version, start, warning/deadline and elapsed-at-request for historical accountability; it does not create a new incident SLA. Unknown inventory cannot remove elapsed outage time: retain original validated start while policy/configuration is repaired.

Additional acknowledgement, handoff-acceptance, department-work and final-validation timers are designed as optional future timer instances `{incident, cycle, kind, owner, start, due, policyVersion, stoppedAt, outcome}` with append-only events. They may warn/escalate through configured native JSM activity but cannot pause/reset the overall incident SLA. Dedicated timer tables and their configuration UI are deferred beyond the mandatory MVP; no mandatory multi-timer engine is added to the hackathon critical path. Owner approval is needed before promoting any extra timer. The 24/7/start-time/reopen/strictest-tier defaults in ADR-0009 remain proposed.

## Sprint 1 configuration boundary — 2026-11-26

Tier and policy configuration are implemented; countdowns, breach processing, calendars and native JSM SLA integration are not. Duration is a positive integer; warning_seconds is an elapsed offset allowing zero and strictly less than duration. Publication stores the trusted actor and validates exclusive effective intervals. Draft content is editable with expected-version checks; publication promotes an exact configured draft or creates a new version. Once published, policy content cannot be edited. Contiguous finite versions are supported; an open-ended version cannot be superseded through this minimal UI yet. Explicitly bounded effective_until values are required when demonstrating subsequent publication on the same tier. Seeded policies are labelled demonstration-only and initially draft. Operational clock/start/impact/reopen decisions in ADR-0009 remain proposed.

## Local implementation — 2026-11-27

Pure deterministic policy/impact/UTC status and guarded workflow functions now exist in domain/incidents. Incident application snapshots and SQL adapter preserve source-time decisions. Operational policies require explicit per-tenant configuration; Sprint1 demonstration-only maps are not promoted. Potential versus confirmed impact, unknown backup capacity/availability and policy gaps remain explicit. Business defaults remain proposed; native JSM SLA calendars/sweep/notification reconciliation and operational persistence are outstanding. See ADR-0019 and sprint-3-execution-report.md.
