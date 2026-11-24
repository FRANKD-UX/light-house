# ADR-0001: Atlassian Forge as the application platform

Date: 2026-11-24

Status: Accepted — owner-approved constraint

## Context

An ISP incident app must run inside the Atlassian ecosystem without separate hosting.

## Decision

All backend orchestration and UI integration run on Forge; Jira Service Management is the ticketing system.

## Rationale

Meets approved stack and competition context; avoids separate backend operations.

## Consequences

Forge permissions, quotas and runtime limits constrain design; registration and installation are external gates.

## Alternatives considered

Separate hosted services and Connect-only architecture were excluded by owner.

## Verification requirements

Register the real app, lint, deploy only when authorised, install on a JSM development site and verify module behaviour.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
