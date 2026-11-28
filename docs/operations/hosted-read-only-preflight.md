# Hosted PoC read-only preflight

2026-11-28. Prepared procedures, not executed evidence. Existing owner directive prohibits hosted mutations, deployment, schema migration, queue submission and ticket creation until prerequisites and scoped authority pass. Read-only queries still consume resources; record a bounded read reservation against existing limits before execution. No tunnel or auth harness expansion is needed.

## One evidence bundle

Keep private target/installation identifiers in the existing owner record. Record capture UTC, selected app/environment/site, data-through UTC or UNKNOWN, actual consumption, pending counts or UNKNOWN, and the boundary of each observation. Latest supplied app-level observation is292 SQL requests at approximately07:05UTC, exact capture/data-through/environment breakdown unknown, up to one hour delay. USD0 current/forecast is an observation, not a cap. Take another comparable observation after the delay window and reconcile any intervening owner activity; do not subtract app-level292 from an assumed DEVELOPMENT-only baseline or double-count600 against existing reservations.

In the existing deployed app, use only these read controls once per admitted step:

1. **Load tenants and schema status**. Require a new loading/completion transition. Record v1 readiness and actual tenant list. The optional **Read development schema diagnostics (Jira administrators)** is bounded read-only v1 evidence, not a v2 inspector or a mutation-recovery action.
2. **Load monitoring tenants** → select the existing **Lantern Fibre (admin)** → **Load monitoring**. Record actual source, receipt and authenticated outcome counts/statuses. If NOT_READY, record failed/unavailable v2, not zero sources or empty backlog. Do not queue setup. If successful, **Next source page** and **Next event page** are read-only; admit a fixed page limit first and report truncation. Latest20 outcomes and a receipt page never prove queue emptiness or absence of older retries.
3. In Developer Console SQL management, select the exact existing DEVELOPMENT installation and inspect schema/details and safe table-data fields only. Compare v1/v2 registries and named checkpoints to the committed immutable migrations. Count/status/UTC/lease fields can support scoped pending evidence; never export event_json, secret_ref, account IDs, private installation identifiers or arbitrary pending payloads. If tables/fields or safe counts are unavailable, retain UNKNOWN. Do not execute DDL, SQL writes, KVS writes, repair or reset.
4. Record known schema/worker job identifiers and their terminal evidence if already retained privately. Do not manufacture jobs to obtain a job ID. The supported [Async Events API](https://developer.atlassian.com/platform/forge/runtime-reference/async-events-api/) exposes stats for a known job ID; that is not a global enumeration of every pending job. This deployed app has no general queue-inspection command. Missing known IDs, incomplete telemetry or absent logs do not prove zero async/schema work. No new runtime endpoint/deployment is introduced for this preflight.

JSM creation/transition intents from local v004/v006 work are not installed just because local tests pass. Check physical deployed schema before referring to any table, and distinguish absent/uninstalled functionality from an empty accepted processing backlog. Do not use local-only UI controls as a hosted procedure. Unknown pending baseline remains a stop condition for mutations until reconciled or covered by a specific reviewed bounded decision; no automatic zero assumption.

## Terminal preparation

Safe local commands, no network or hosted writes:

```sh
npm run test:webhook:dry-run
npm run test:e2e:check
```

The existing private harness is read-only but its approved version/target must still match; do not run native browser acceptance against major4 by relaxing its Sprint1 version policy. No browser access host is currently available in this session. Reuse owner authentication only through its documented flow if later needed; do not inspect session contents.

A prepared JSM discovery runner uses fixed GET-only service-desk/request-type endpoints, bounded pagination and sanitised output. Its exact commands and mock verification are recorded when implementation passes. Use existing authorised credentials only; no new account/token/scopes are implied. Do not assume tenant display name equals project name, choose a request type from a different project, or invoke create endpoints to test access.

After discovery, return one curated bundle: public synthetic project key/desk/type IDs and required field names; page limits/truncation/permissions failures; current resource scope/lag; existing schema/pending/receipt evidence and explicit unknowns. Then prepare one concrete bounded hosted acceptance approval under sprint-2-hosted-acceptance.md. Private source provisioning, URL generation, migration and HTTP intake remain prepared actions until that approval. All Sprint1 data, outstanding identity/isolation/security/licence/native release gates remain mandatory.

Official API documentation checked2026-11-28; Forge/ADS MCP unavailable. No custom diagnostic endpoint, arbitrary queue submission or unsupported global pending-list command is proposed.
