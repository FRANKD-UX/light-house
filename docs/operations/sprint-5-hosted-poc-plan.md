# Sprint 5 hosted POC acceptance proposal

Date: 2026-11-28. Prepared during recovery; ALL mutations below are HOLD pending applicable owner approval. No Sprint 6. Local adapted SQLite/mock Jira evidence does not satisfy hosted criteria. Exact target details belong in owner-only records; never guess IDs. Existing installation is last recorded DEVELOPMENT major 4 at source 2b97545; current embedded-context artifact is UNDEPLOYED.

## Sequence and side effects

| Operation                                   | Prerequisites and expected side effects                                                                                                                                                                               | Success evidence                                                                                                                                                                    | Stop condition                                                                                                                                                        |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Access or provision synthetic project    | Admin resolves zero visible projects; owner approves existing access or exact LHNOC proposal. Creation/access/fields can change schemes, portal visibility, permissions and notifications. Existing entitlement only. | Verified project/key/model/template and responsible admin; no invented IDs or extra billable seats.                                                                                 | Permission/ownership ambiguity, duplicate key, paid/trial prompt, broader data exposure or unapproved shared scheme change.                                           |
| 2. Read-only JSM configuration discovery    | Known accessible project; connector GET metadata chain, bounded pages. Read/API consumption only.                                                                                                                     | Desk/project association, request type, required/allowed fields and all exact IDs verified.                                                                                         | Empty/incomplete/403 metadata, unsupported required form/field or incompatible schema.                                                                                |
| 3. Freeze exact Forge artifact              | Reviewed local head, clean locked build, official lint, bundle/permission/security review and renewed exact-tree development risk acceptance. Build/package only until deployment approval.                           | Commit/tree/lock/manifest and emitted resource SHA256 recorded; lint pass or explicit reviewed rule disposition.                                                                    | MAJOR_VERSION_RULE without approval, other lint error, unexpected scope/egress, secret or unreviewed artifact. Never use --no-verify as an implicit remedy.           |
| 4. Deploy DEVELOPMENT                       | Explicit exact-artifact/environment approval after preflight. Changes functions/resources and may introduce a new major; no production target.                                                                        | CLI success plus deploy history/version; preserved genuine app ID.                                                                                                                  | Target mismatch, failure/timeout/unknown outcome; inspect history before any retry.                                                                                   |
| 5. Upgrade existing installation            | Separate consent for actual new major/scopes; confirm same approved installation/site. Permission/version changes only as approved.                                                                                   | Readback installation/version/up-to-date and working status correlation.                                                                                                            | Unexpected site/product/permission/terms/billing prompt or unapproved install. No second installation inferred.                                                       |
| 6. Establish schema readiness               | Fresh pending/receipt baseline first. Explicit migration approval, preserve existing data and immutable v001/v002. Native DDL/queue/checkpoint writes.                                                                | Applicable v001→v002→v003/v004→v005 registries/checkpoints and environment match. v006 stays unregistered and is not required for this create/read POC.                             | Pending/failed/unknown earlier migration, schema drift, budget uncertainty, destructive operation. Admission is not completion.                                       |
| 7. Confirm pending/intent/receipt baseline  | Supported authenticated app reads/curated evidence, no arbitrary SQL endpoint. Read consumption; include all relevant pages, leases/due times and in-flight work.                                                     | Known baseline, stable receipts/intent states and retry obligations with UTC, or explicit UNKNOWN.                                                                                  | UNKNOWN, partial/ambiguous baseline, unresolved active lease/uncertain prior write; never interpret absent logs as zero.                                              |
| 8. Configure synthetic source               | Explicit KVS/source/public-ingress authority, trusted tenant-admin and exact source-version/security review. Secret/config/rotation intents/URL exposure may be created.                                              | Stored installation/source/tenant binding, active credential reference and privately controlled endpoint; no secret in SQL/logs/chat.                                               | Pending mutation, unexpected egress/real source, secret disclosure, unapproved URL/rotation or KVS failure.                                                           |
| 9. Map resource and dependency inventory    | Authorised synthetic tenant/topology/configuration and clean parent; mapping/policy/JSM config/NOC configuration writes under expected-version CAS.                                                                   | Verified site/uplink/service/customer/tier links, policy and desk/type/field map; same-tenant references only.                                                                      | Foreign/missing/inactive reference, pending state, policy gap or incompatible gateway metadata.                                                                       |
| 10. Ingest bounded synthetic problem        | Explicit event count/IDs/window/budget and source transport approval; sends authenticated event, inbox/queue/evidence/incident/intent/Jira and native notification side effects.                                      | One accepted receipt processed ready, expected known/unknown impact and immutable SLA; unique linked create intent.                                                                 | Rate/budget threshold, auth or mapping failure, unexpected queue growth, ambiguous outcome or target mismatch. No blind retry POST.                                   |
| 11. Verify native Jira request and receipts | Read actual app-created request plus complete receipt/intent readback; read consumption.                                                                                                                              | Exact project/desk/type, synthetic fields, marker, one issue mapping/attempt/audit and correlation UTC; notification delivery accepted separately if observed.                      | Unlinked/multiple/near marker matches, field mismatch, missing receipt or uncertain POST; reconcile original intent, never create substitute via connector.           |
| 12. Replay duplicate within agreed bound    | Separate included duplicate count and same event identity; may increment duplicate count and enqueue supported processing, never another intended Jira request.                                                       | Same inbox/incident/SLA/intent/issue identity; duplicate count changes as expected; no second create.                                                                               | New request/incident, missing durable evidence, delayed work outside reservation or uncertainty.                                                                      |
| 13. Verify NOC board/workspace              | Approved current-user reads and explicit operational initialisation if needed (a write requiring scope); read filters/page/current summaries.                                                                         | Correct tenant/site/customer/owner/stage/SLA/Jira link and readiness states; keyboard/no stale data.                                                                                | Cross-tenant visibility, inconsistent summary, hidden failure, mutation without authority.                                                                            |
| 14. Verify embedded Jira context            | Exact deployed module/resource and consenting user with Jira plus tenant rights; bounded explicit load/retry. Revocation/expiry setup is separately approved configuration mutation.                                  | Correct server context/module-key evidence, asUser issue/project access, current tenant grant, safe snapshot/current state; denial tests and genuine host light/dark/layout checks. | Private field leak, guessed key fallback, foreign user access, stale grant acceptance, CSP/Bridge errors. No closure permission.                                      |
| 15. Resource/postflight reconciliation      | Before/after same-environment usage capture with data-through lag; bounded log/receipt checks; no reset. Reads and report only.                                                                                       | Actual deltas plus unmetered/in-flight bound, pending obligations/stop state, approved ceilings respected.                                                                          | Unknown headroom, reserved remaining allowance exceeded, delayed unexpected work or reporting ambiguity. Stop further input; preserve evidence, no unapproved repair. |

## Admission and budgets

Before ANY hosted write, record target/version/artifact hashes, explicit operation/notification scope, consenting identities, schema/pending/receipt baselines and environment-attributed usage with UTC/data-through and delay/in-flight allowance. Pending may need a read-only baseline before schema/source actions; if the current app cannot expose it, stop and propose an explicitly reviewed diagnostic rather than guessing. This table is a dependency plan, not a script that bypasses missing capabilities.

The historical additional2,000/cumulative5,000 SQL limits remain shared across sessions. Reconcile historical reservations before proposing exact per-operation allocations; do not add a fresh budget. The previous292 SQL figure and USD0 forecast are stale observations. All unmeasured pending work, current usage, JSM identities and native compatibility remain UNKNOWN. No paid resource, production deployment, real monitoring/customer traffic, tunnel, arbitrary SQL/diagnostic endpoint, credential in chat or external email.

Exact mutation execution commands will be frozen only after IDs/artifact/version and supported CLI flags are confirmed. Intended order is `forge lint --environment development --non-interactive`, approved exact DEVELOPMENT deploy, supported existing-installation upgrade if required, then existing explicit administrator readiness/configuration actions. Never run migration on read or silently register v006. Use the existing synthetic transport runner only under a reviewed request count and approved target. Stop after the bounded scenario, not an open-ended load test.

## Acceptance and limits

A successful create/read/duplicate/NOC/context POC is not full programme completion. Native closure remains disabled; workflow bypass enforcement, causal transition confirmation, installation isolation, R-01–R-14, installed theme evidence, retention, licence and LH-014 release disposition remain independently open. Recovery event acceptance, if separately included, must preserve SLA/state and must not resolve/close Jira. Real integration/notifications may not be credited from mocked gateway responses.

Record actual commands/exit codes/version/hash, sanitised counts/UUID/UTC, scope and any unknowns in audit and continuation state. Retain private target/credentials/auth/evidence outside Git; only curated redacted results may be proposed for publication. On failure preserve the original intent/receipt and report the unresolved side effect; no reset/repair/retry outside the approved envelope.

References verified2026-11-28: [Forge lint](https://developer.atlassian.com/platform/forge/cli-reference/lint/), [environments and versions](https://developer.atlassian.com/platform/forge/environments-and-versions/), [JSM contract](../integrations/jsm-programme-contract.md), [configuration proposal](synthetic-jsm-project-proposal.md), [existing hosted controls](sprint-2-hosted-acceptance.md). Official documentation is not hosted acceptance.

## Current 20-operation admission envelope — 2026-11-28

This dated envelope supersedes the earlier 15-row sequence for the proposed next session, preserving its historical constraints. **All mutations remain HOLD.** Preparation/configuration is approved in principle only. Current source and CI artifact is1d81253; any replacement needs its own evidence/approval. Native closure remains disabled.

Proposed maximum session reservation: **600 SQL requests**, carved from the already shared additional2,000/cumulative5,000 ceilings after all historical spent/pending/reservations are reconciled. This is a proposed ceiling, not measured cost, new headroom, a billing cap or a claim that the scenario fits. The per-step allocations below sum600; no unused allocation transfers automatically. Native function/queue delivery, KVS/SQLcompute/storage/logs and JiraREST resource bounds must also be supplied in the approval ledger; they are currentlyUNKNOWN, not zero. Until static/native upper bounds including retries, fanout, in-flight work and metering delay fit those approved allowances, **no hosted mutation is admitted**. A delayed Console meter alone cannot enforce a per-step cap.

For each step the numeric SQL allocation is a reservation proposal, not authority. Counts bound initiator actions; platform redeliveries must be separately bounded and charged before admission. Reject the session if a supported channel cannot prove/observe a required bound. Deployment/install steps allocate0applicationSQL because migration-on-read is absent, but platform/API/health usage is separately reserved. Project provisioning and required field changes are a separate predecessor approval, not hidden in these20 operations. Maximum proposed wall-clock session30minutes; no background polling, automatic rerun or credit-limit workaround. Stop on any global cap/identity/target/security mismatch, retain original idempotency identities and ask for a specific recovery decision.

### 1. Fresh DEVELOPMENT usage baseline

- Prerequisites and authority: Existing owner-authorised Console reads; current environment attribution, UTC capture, data-through and reporting lag. No new mutation authority.
- State, maximum count and budget: No state change. Maximum2 captures(initial and postflight; step20 uses second). Proposed SQL reservation: 0. All other resource bounds remain admission requirements.
- Success and required evidence: Record SQL/functions/KVS/logs/storage/current cost, unmetered/in-flight allowance and prior reservation ledger.
- Stop and failure handling: If attribution, delay bound or remaining allowance is UNKNOWN, admit no write. Preserve capture; do not reset counters.

### 2. Pending jobs, intents and receipts

- Prerequisites and authority: Supported authenticated app reads with authorised tenant; exhaustive applicable bounded pages and schema state. Read consumption only.
- State, maximum count and budget: No state change. Maximum4 overview/page reads; missing capability is not permission for arbitrary SQL or a new endpoint. Proposed SQL reservation: 40. All other resource bounds remain admission requirements.
- Success and required evidence: Record existing receipt IDs/counts, intents/leases/due times, parent pending flags and outstanding deliveries at UTC; distinguish complete from partial.
- Stop and failure handling: Any unknown/partial baseline or unresolved prior uncertain write stops admission. Preserve original intent; no repair or queue replay.

### 3. Exact-artifact authenticated Forge validation

- Prerequisites and authority: Freeze published 1d81253 or separately approved replacement; local gates/current scopes/hash review and explicit major-change acknowledgement before --approve.
- State, maximum count and budget: No deployment/state write. Maximum1unapproved lint already observed; one approved lint proposed only after owner decision. Proposed SQL reservation: 0. All other resource bounds remain admission requirements.
- Success and required evidence: Record manifest/artifact/lock hashes and CLIexit/rules; separate local schema validity from platform approval.
- Stop and failure handling: Any unexpected rule/error/scope or artifact change stops. No --no-verify or forced downgrade.

### 4. Approved DEVELOPMENT deployment

- Prerequisites and authority: Separate owner exact-artifact/risk/target approval plus admitted metering/pending baseline and lint.
- State, maximum count and budget: Changes hosted code/resources/version. Maximum1 deploy; no automatic retry. Proposed SQL reservation: 0. All other resource bounds remain admission requirements.
- Success and required evidence: Explicit CLI success plus history/version/readback and saved official package inspection; do not guess next major.
- Stop and failure handling: Timeout/failure means indeterminate outcome: read history before any further approval; no redeploy blindly.

### 5. Approved installation upgrade

- Prerequisites and authority: Actual new major established, same existing approved site/product, admin consent and separate upgrade authority.
- State, maximum count and budget: Changes installation code/permissions. Maximum1upgrade,0 new installations. Proposed SQL reservation: 0. All other resource bounds remain admission requirements.
- Success and required evidence: Readback exact installation/version/up-to-date and current health/resources; installation success is not POC acceptance.
- Stop and failure handling: Unexpected target/terms/scopes/paid prompt stops. No bulkupgrade/autoaccept/new installation.

### 6. Applicable schema readiness

- Prerequisites and authority: Explicit DDL/queue authority, known v1 state and clean pending baseline; all immutable registry definitions/hashes reviewed.
- State, maximum count and budget: At most2 schema admission actions: v002 if needed, then existing incident consumer for v003→v004→v005. No v006. Proposed SQL reservation: 130. All other resource bounds remain admission requirements.
- Success and required evidence: Curated checkpoint/readiness/environment evidence for every applicable version; admission≠completion. Max4 readbacks within this reservation.
- Stop and failure handling: Drift/pending/failure or unknown redelivery bound stops. Preserve checkpoints; no reset/destructive rerun. Establish total bounded delivery SQL before admission.

### 7. Synthetic tenant and inventory readiness

- Prerequisites and authority: Existing Lantern Fibre trusted context/admin, same-tenant references and explicit inventory/policy write authority only if gaps exist.
- State, maximum count and budget: Reuse verified inventory. Maximum13 inventory saves and 2 policy publications if separately approved;0 newtenants/accounts. This is a ceiling, not an instruction to reseed. Proposed SQL reservation: 80. All other resource bounds remain admission requirements.
- Success and required evidence: One site/carrier/uplink/customer, two services/dependencies/tiers, one NOCteam/assignee/membership; immutable effective policy snapshots verified.
- Stop and failure handling: Any foreign/inactive/pending reference, required extra entity or uncertain partialwrite stops. Read back before CAS repair proposal.

### 8. Synthetic monitoring source provisioning

- Prerequisites and authority: Separate source/KVS/secret/publicendpoint exposure authority and reviewed version/bindings; no real monitoring.
- State, maximum count and budget: Maximum1 source config/secret binding and 1 URL retrieval if needed;0rotation/extra credentials. Proposed SQL reservation: 40. All other resource bounds remain admission requirements.
- Success and required evidence: Private installation/source/tenant binding and KVSreference confirmed; no credential/URL in chat, SQL or public logs.
- Stop and failure handling: Unknown source state, secret exposure, partial intent or unexpected egress stops. No rotation/cleanup/retry without fresh authority.

### 9. Resource and gateway mapping

- Prerequisites and authority: Verified synthetic source/uplink and actual project/desk/type/required/allowed fields; dual admin/CAS permissions.
- State, maximum count and budget: Maximum1 resource mapping,1JSMconfiguration save and 1 NOCconfiguration save,0guessed IDs. Proposed SQL reservation: 40. All other resource bounds remain admission requirements.
- Success and required evidence: Map exact runner resource synthetic:lh-103-acceptance; configuration passes gatewaymetadata checks and current requiredfield formats.
- Stop and failure handling: Any mismatch/incompatible hiddenfield/extra requiredfield/pendingCAS stops; propose exact minimum configuration correction.

### 10. Authenticated monitoring ingestion

- Prerequisites and authority: Explicit event/notification/queue scope, private endpoint/key binding, resource map and total worker fanout/retry upperbound admitted.
- State, maximum count and budget: Maximum1existing acceptance-runner batch,≤11 HTTP submissions, one generatedproblem identity,0 automatic reruns. Optional revokedcase only with separately approved pre-existing revokedcredential; otherwise10 requests. Proposed SQL reservation: 60. All other resource bounds remain admission requirements.
- Success and required evidence: Curated expected401/400/202/409 outcomes and accepted original event identity; HTTP202 is not processing completion.
- Stop and failure handling: Unexpected result/timeout/rate/budget/queue growth stops initiating input. Two concurrent duplicate submissions may already be in flight and must be reserved. Do not rerun generator; it creates a newproblem ID.

### 11. Dependency and customer-service impact

- Prerequisites and authority: Same causal receipt/worker from step10; no second ingestion/processing solely for this check.
- State, maximum count and budget: Expected one incident/evidence association from stored mapping; maximum2 readbacks. Proposed SQL reservation: 30. All other resource bounds remain admission requirements.
- Success and required evidence: Expected distinct customer/service impact, completeness/unknown flags and original resource binding; compare to approved synthetic topology.
- Stop and failure handling: Missing/unknown/mismatched impact or schema stops; record receipt/prerequisite failure, no invented known zero.

### 12. Priority and SLA policy

- Prerequisites and authority: Verified configured effective policy/tiers and same immutable incident; selected unknown-impact rule must be approved.
- State, maximum count and budget: No extra event or policy rewrite; maximum2 readbacks. Proposed SQL reservation: 20. All other resource bounds remain admission requirements.
- Success and required evidence: Priority/policyversion/start/warning/deadline/tier choice match UTC calculation; team changes/replay do not reset snapshot.
- Stop and failure handling: Policy gap/unmappedseverity/unapproved default or changed snapshot stops native acceptance; preserve incident and propose correction separately.

### 13. Native JSM incident creation

- Prerequisites and authority: Step9verified app access, exactdesk/type/fields and requestcreate/notification authority; same stored intent/pipeline.
- State, maximum count and budget: One logicalcreate intent; initial session maximum1outbound createPOST,0manual retries/reconciliation writes. Actual automaticcausal calls must be proven bounded before admission. Proposed SQL reservation: 40. All other resource bounds remain admission requirements.
- Success and required evidence: Actual app-created issue ID/key/project/desk/type/field marker readback, maximum4 product reads and one intendedissue. Connector-created substitute is not acceptance.
- Stop and failure handling: Ambiguous/lostresponse/429/configuration drift stops; retain originalintent, no second POST. Separate bounded reconciliation authority required.

### 14. Durable receipt verification

- Prerequisites and authority: Complete supported curated receipt/intent reads and correct tenant/installation.
- State, maximum count and budget: No mutations; maximum2 readbacks. Proposed SQL reservation: 20. All other resource bounds remain admission requirements.
- Success and required evidence: One monitoringreceipt/incident/createintent/issuelink; attempts/state/UUID/UTC/readiness correlate; no private requests/tokens exposed.
- Stop and failure handling: Missing/partial receipt or conflicting mapping stops; UNKNOWN staysUNKNOWN, never zero.

### 15. Duplicate and idempotency acceptance

- Prerequisites and authority: Use duplicates already included in step10runner; do not start a secondbatch. Account for all existing deliveries.
- State, maximum count and budget: No additional HTTP/event submission; maximum3 receipt/intent/Jira readbacks. Proposed SQL reservation: 40. All other resource bounds remain admission requirements.
- Success and required evidence: Same event/inbox/incident/SLA/intent/issue; duplicate count expected3 from duplicate+twoconcurrent sends, changedseverity409; no secondcreate.
- Stop and failure handling: Newincident/issue or unsettledprocessing stops; preserve evidence/in-flight reservation and do not replay to test again.

### 16. Operational NOC board

- Prerequisites and authority: Exact resources/currenttenant role/schema and approved initialisation if not already present.
- State, maximum count and budget: Maximum1initialise command only if separately approved;2board/summary reads,0handoff/close. Proposed SQL reservation: 10. All other resource bounds remain admission requirements.
- Success and required evidence: Current owner/team/stage/SLA/Jira association and readiness shown for same incident, successful replay not assumed.
- Stop and failure handling: Wrongtenant/stalecurrentstate/privatefield/error stops. No unapproved operational command or repair.

### 17. Embedded Jira context

- Prerequisites and authority: Exact module/resource installed; trusted account/issue/project/runtime plus positive asUser and active tenant grant.
- State, maximum count and budget: Read-only explicitload; maximum2 context reads,0selectors/mutations. Proposed SQL reservation: 10. All other resource bounds remain admission requirements.
- Success and required evidence: Server-context/modulekey evidence, correct snapshot/currentowner/SLA and safe projection; correlation/UTC.
- Stop and failure handling: Unknownshape/denial/privateleak/CSP/Bridge failure stops; no wildcard/fallback context or app impersonation.

### 18. Tenant isolation and access revocation

- Prerequisites and authority: Consenting existing testidentity with explicit grant mutation scope; established tenant/Jira baseline and reserved restoration plan.
- State, maximum count and budget: Maximum1 revocation+1 approved restoration,3 context/overview reads;0 newaccounts/secondinstallations. Proposed SQL reservation: 30. All other resource bounds remain admission requirements.
- Success and required evidence: Previously allowed linkeddata is denied after revocation; other-tenant-only identity denied; authorised state restored only if approved.
- Stop and failure handling: No suitable identity/consent/support or failed denial stops; do not invent identity or weaken gates. If restoration uncertain, report it; no repeated grants.

### 19. Installed host theme verification

- Prerequisites and authority: Host selector available and exact hosted resources; existing authenticated ownerUI, no retry of unavailable automation.
- State, maximum count and budget: At most2host theme selections and 2explicit context/board loads,0datawrites. Proposed SQL reservation: 10. All other resource bounds remain admission requirements.
- Success and required evidence: Genuine light/dark readability/focus/layout and no appiframe errors; curated owner evidence, no screenshots/HAR/sessiondump.
- Stop and failure handling: Selector/host unavailable means UNVERIFIED; retain visual deferral and do not markpassed. Any error stops further loads.

### 20. Post-acceptance usage and evidence

- Prerequisites and authority: Second matched Consolecapture from step1, same environment/data-through basis, pendingdelivery ledger and all outcome evidence.
- State, maximum count and budget: No mutations. Maximum1postflight capture(already counted in step1),2 bounded sanitised log windows; no resetting counters. Proposed SQL reservation: 0. All other resource bounds remain admission requirements.
- Success and required evidence: Actual deltas plus unmetered/in-flight upperbound/residual reservation and any pending effects recorded; no zero assumption from missinglogs.
- Stop and failure handling: Delayed/unknownmetering or exceededreservation stops additionalinput. Preserve receipts/intent/targetprivately; no unapprovedcleanup/redeploy.

No steps were executed under this envelope. Current usage, pending jobs/intents/receipts, native queue bounds, applicable schema and JSM target IDs remain UNKNOWN. The full acceptance runner already contains duplicate/negative cases; do not silently execute it once for ingestion and again for duplication. Recovery-event input is outside this initial bounded batch unless separately added with a revised resource reservation. Native notifications remain explicit side effects requiring consenting recipients; no external email. Native closure, full lifecycle enforcement, second-installation/R-01–R-14 and production readiness are not accepted by a successful create/read POC.
