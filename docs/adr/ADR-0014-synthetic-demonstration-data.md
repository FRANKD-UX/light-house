# ADR-0014: Synthetic demonstration data

Date: 2026-11-24

Status: Accepted — owner-approved constraint

## Context

Judges need an exercisable ISP scenario without private infrastructure or employer assets.

## Decision

Invent ISPs, topology, carriers, customers and event fixtures; label simulated monitoring separately from real JSM integration.

## Rationale

Protects confidentiality and makes evaluation reproducible.

## Consequences

A fixture does not prove real Zabbix connectivity; actual JSM creation and installation must be demonstrated later.

## Alternatives considered

Production/employer payloads and hardcoded success paths rejected.

## Verification requirements

Review every fixture and recording for IP/secrets; install independently, exercise duplicates/recovery and policy changes using synthetic data.

## Official references

[Official documentation](https://codegeist2026.devpost.com/rules), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
