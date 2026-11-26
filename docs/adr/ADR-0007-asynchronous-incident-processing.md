# ADR-0007: Asynchronous incident processing

Date: 2026-11-24

Status: Proposed — implementation default pending owner review

## Context

Ingress must acknowledge quickly and external APIs may time out/rate limit.

## Decision

Durable inbox then Forge Async Events with checkpointed workers; bounded scheduled repair and deadline sweeps only when implemented.

## Rationale

At-least-once delivery is documented; ledger repairs queue/write gaps.

## Consequences

Retention is bounded, scheduling eventual, no ordering/exactly-once guarantee. Retry exhaustion is visible manual review.

## Alternatives considered

Inline end-to-end webhook processing risks execution limits; external queue/backend excluded.

## Verification requirements

Simulate push failure, duplicate dispatch, worker timeout, expired retention and bounded backlog recovery.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
