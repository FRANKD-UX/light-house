# ADR-0006: Webhook authentication

Date: 2026-11-24

Status: Proposed — auth requirement owner-approved; mechanism pending owner review

## Context

Forge webtrigger URLs are public and Zabbix must authenticate without invented crypto support.

## Decision

Propose per-source random bearer over HTTPS using custom headers and KVS secrets; public credential ID selects trusted tenant/source metadata. Add bounded timestamps, durable duplicate controls and rotation.

## Rationale

Zabbix HttpRequest headers and Forge handler header checks are documented.

## Consequences

Bearer compromise permits source event forgery until revocation; timestamp replay control is not a signature. Proposed 24h rotation overlap and age/skew need owner review.

## Alternatives considered

URL secrecy/IP-only controls rejected. HMAC deferred until compatible source primitives are verified; Basic auth adds no needed benefit.

## Verification requirements

On actual pinned Zabbix/Forge runtimes test header parsing, constant-time comparison, bad/revoked/rotated secrets, replay bounds and tenant spoofing.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/manifest-reference/modules/web-trigger/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
