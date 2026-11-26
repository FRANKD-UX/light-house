# ADR-0012: Cost governance

Date: 2026-11-24

Status: Accepted — minimise infrastructure/billing owner-approved; controls proposed

## Context

Forge has consumption billing beyond allowances and noisy events can drive usage.

## Decision

No paid provisioning or deployment in Sprint 0. Propose per-source admission/retry budgets, bounded scans/logs, retention and usage alerts before running ingestion.

## Rationale

Forge-native does not imply unlimited free execution.

## Consequences

Limits can delay incidents; owner chooses budgets/alert recipients and approves any paid exposure. No billing account inspected.

## Alternatives considered

Unbounded polling/retries and separate infrastructure rejected.

## Verification requirements

Recheck pricing/allowances and billing settings before deployment; estimate synthetic scenario and verify usage metrics after authorised tests.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/forge-platform-pricing/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
