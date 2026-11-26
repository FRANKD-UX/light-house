# ADR-0010: External identity mapping

Date: 2026-11-24

Status: Accepted — providers/manual fallback and Atlassian authority owner-approved; provider flows proposed

## Context

NOC assignments may reference external directories, but authentication is already Atlassian-owned.

## Decision

Entra/Google adapters map immutable provider subject to assignee and verified Atlassian accountId; manual mapping remains available and separately authorised.

## Rationale

Avoids replacing Forge login or conflating email/customer/network identities.

## Consequences

Consent, directory API permissions and unattended flows remain unverified; no automatic access grants from mappings.

## Alternatives considered

External SSO replacement and email-as-primary-identity rejected.

## Verification requirements

Verify current provider official REST docs, admin consent/revocation, ambiguous mapping, disabled user and manual fallback.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/use-an-external-oauth-2.0-api-with-fetch/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
