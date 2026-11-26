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

## Sprint 0.5 refinement — 2026-11-25

Retain the scaffold. Proposed global-page command centre/board/drawer/workspace, issueContext embedded view and adminPage are documented with verified official module links in project/architecture.md. No new surface is implemented or required in Sprint 0.5; Jira remains the ticketing workspace. Module visibility is not mutation authorisation. Advanced frontend customisation remains deferred.

## Final foundation diagnostic refinement — 2026-11-26

Owner-requested acceptance refinement: use the installed shell's sanitised manual health check to verify the actual Bridge response, instead of locating its raw Network payload. Validate unknown results at runtime; show only projected public metadata and a valid internally generated UUIDv4 correlation. Keep semantic HTML/status announcements and host design tokens, with no polling or additional dependencies. No new extension point or backend capability.

The existing host theme activation follows [Forge theming](https://developer.atlassian.com/platform/forge/design-tokens-and-theming/), verified 2026-11-26. Local injected-token tests are simulated compatibility evidence. Installed theme comparison is unverified; a proposed move to Sprint 5 is pending explicit owner disposition.

Final acceptance evidence — 2026-11-26: owner confirms genuine installed diagnostics/contract/UUIDv4; independently matched development backend.status success and scoped Light House iframe Console retry pass. Host light/dark comparison explicitly deferred to Sprint 5 because selector unavailable; remains unverified. This closes foundation runtime acceptance with that limited visual disposition, without approving future operational surfaces or Sprint 1 implementation.
