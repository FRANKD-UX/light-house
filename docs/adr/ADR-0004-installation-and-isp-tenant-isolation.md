# ADR-0004: Installation and ISP tenant isolation

Date: 2026-11-24

Status: Proposed — logical isolation design; isolation requirement owner-approved

## Context

Forge isolates installations but an installation may serve multiple ISPs.

## Decision

Use trusted installation context plus app tenant context everywhere; tenant-prefixed keys/indexes and server-verified membership/reference ownership.

## Rationale

Prevents one monitoring source or NOC user accessing another ISP.

## Consequences

No database FK/row-level isolation is assumed inside an installation; every repository and join needs review and negative tests.

## Alternatives considered

One installation per ISP is simpler but unnecessarily excludes multi-ISP operations; caller tenant ID alone is unsafe.

## Verification requirements

Two-tenant and two-installation negative tests across SQL, KVS, resolver and queue boundaries.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/storage-reference/sql/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.

## Sprint 1 implementation — 2026-11-26

The assigned scope now implements this logical separation. Installation/environment come from getAppContext; resolver accountId is the authenticated actor. A backend asUser Jira ADMINISTER global-permission check authorises installation bootstrap/recovery. Ordinary access requires an unexpired active ISP grant. Directory/team identity never grants access. Local two-ISP and two-database simulations pass; actual two-installation evidence remains unavailable.
