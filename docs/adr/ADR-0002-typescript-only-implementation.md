# ADR-0002: TypeScript-only implementation

Date: 2026-11-24

Status: Accepted — owner-approved constraint

## Context

One implementation language is required across frontend, backend and integration contracts.

## Decision

Use strict TypeScript for React Custom UI, Forge handlers, domain/application code and runtime adapters. Tool configuration may use JS/JSON/YAML; no Python backend.

## Rationale

Shared contracts and predictable tooling keep the foundation small.

## Consequences

Runtime input validation is still necessary; TypeScript types do not validate untrusted payloads.

## Alternatives considered

Python backend and Next.js were expressly excluded.

## Verification requirements

Run strict typecheck and behaviour tests; inspect deployed package compatibility in the authenticated gate.

## Official references

[Official documentation](https://developer.atlassian.com/platform/forge/function-reference/nodejs-runtime/), reviewed 2026-11-24. Capability verification and limitations are consolidated in [assessment](../project/forge-capability-assessment.md); decisions above are Light House architecture choices, not claims of platform guarantees.
