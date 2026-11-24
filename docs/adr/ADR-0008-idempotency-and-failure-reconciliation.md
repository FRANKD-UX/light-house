# ADR-0008: Idempotency and failure reconciliation

Date: 2026-11-24

Status: Proposed — reliability design pending owner review

## Context

Concurrent monitoring deliveries and unknown Jira POST outcomes can create duplicates.

## Decision

Unique canonical tenant/source/event/kind digest, stable problem aggregate, optimistic claims and intent marker embedded in initial Jira creation; reconcile unknown outcomes before another create.

## Rationale

Neither queue delivery nor Jira writes establish exactly-once processing.

## Consequences

Search lag means zero results cannot prove failure; unresolved ambiguity requires operator review. Duplicate suppression does not correlate distinct topology events.

## Alternatives considered

Blind retry and post-create-only markers rejected.

## Verification requirements

Stress duplicates; simulate Jira commit then network loss and mapping-write loss; verify marker search and exact candidate matching on target project.

## Official references

[Official documentation](https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issues/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
