# ADR-0009: SLA ownership and native JSM interoperability

Date: 2026-11-24

Status: Proposed — 24/7 assumption explicitly requires owner review

## Context

ISPs need configurable P1/P2/P3 deadlines while JSM owns calendars and native metrics.

## Decision

App uses UTC 24/7 elapsed time from validated problem occurrence, versioned effective policies, warning offsets and historical snapshots. Native JSM SLA metrics are configured separately and reconciled, never assumed created by app fields.

## Rationale

Deterministic NOC deadlines and transparent divergence are preferable to hidden calendar assumptions.

## Consequences

Owner must approve clock model, unknown-impact policy, strictest impacted tier and reopen cycle behaviour. Warning sweeps are eventual and native notification behaviour needs configuration.

## Alternatives considered

Business-hours-only clocks deferred; silently treating app deadline as native SLA rejected.

## Verification requirements

Test UTC/effective-time boundaries, policy immutability, unknown impact and resolution/reopen cycles; compare real JSM metric and app snapshot.

## Official references

[Official documentation](https://support.atlassian.com/jira-service-management-cloud/docs/set-up-sla-goals/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
