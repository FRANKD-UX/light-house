# ADR-0013: Forge UI architecture

Date: 2026-11-24

Status: Proposed — selected scaffold default pending installed-runtime verification

## Context

NOC inventory and lifecycle need an internal workspace.

## Decision

React 18 TypeScript Custom UI on jira:globalPage, Forge Bridge resolver, host design tokens and semantic HTML. Use individual Atlassian components after compatibility review.

## Rationale

Official Jira Custom UI/module docs support the boundary; React 18 satisfies current transitive peer requirements.

## Consequences

Relative asset base and host theme integration require iframe/browser verification; no fake metrics or integration states.

## Alternatives considered

UI Kit is compatible but less suited to the planned interface; Next.js/separate frontend hosting excluded.

## Verification requirements

Build resources, unit-test loading/failure/unmount states and verify installed Jira navigation, iframe CSP, light/dark theme and real Bridge invocation.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
