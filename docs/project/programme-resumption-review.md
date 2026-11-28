# Programme resumption review

2026-11-27. Read-only baseline: `557aecf0fb350c85570398d23aade16c4da6b223`, clean entry tree on `sprint-3/incident-orchestration`. This specialist resumed the existing thread successfully after the owner-reported reset; no replacement agent or repeated usage attempt was needed. No account allowance, reset category or automatic scheduler is inferred. The deployed DEVELOPMENT major4 remains `2b97545fe87e5d3d371ab2982da7e41b7614d834`; local source checkpoints and the prior295-test validation are not deployed/native acceptance.

Only this review document is written by this assignment. No source, dependency, scanner, hosted state, authentication artifact or private target was changed/read. The lead owns catch-up and workflow implementation and integrated validation.

## Catch-up plan approved with explicit boundaries

Use a manually invoked administrator action that scans **all** stored ready monitoring receipts in the trusted installation/tenant, joined to the active source and active/nonpending tenant. Do not filter candidates solely by missing incident_evidence: evidence is persisted before enrichment, so its presence cannot prove incident/JSM completion. Also avoid fragile combined EXISTS filters that accidentally hide configuration, mapping, expired-sending or mapping-write gaps. Scanning linked receipts entails extra bounded reads but preserves replay safety through existing intent/incident uniqueness.

The initial query returns20 rows plus one sentinel, ordered by stable inbox UUID, with a validated keyset cursor; all predicates remain installation/tenant/source scoped and no cursor chooses authority. Process at most20 sequentially through one shared downstream pipeline used by the monitoring callback. Do not fan out20 JSM operations under an unbounded invocation budget. Return actual per-row fixed categories and the next cursor from the last attempted row, including a failed row. The sentinel is not processed. No recursive next-page loop, automatic schedule, SQL schema expansion or silent broad requeue is required for this local slice.

Pipeline results must distinguish awaiting_schema, awaiting_configuration, awaiting_problem, manual_triage, linked, pending/retry_wait/ambiguous/manual_review and fixed failures. A skipped prerequisite is not completion; a failed lookup is not an empty success. Preserve source/inbox IDs and correlation only where authorised; do not include body, raw exception or external response text. A missing JSM configuration must not issue HTTP. Existing live lease/due-time/attempt checks remain authoritative. Cursor advancement prevents one old blocked receipt monopolising every page; a deliberately restarted bounded cycle can revisit a prior failure after its prerequisite changes. New random UUIDs inserted before a passed cursor require a later cycle, so reaching the end is not a concurrent global-completeness guarantee.

This uses durable inbox/evidence/incident/intent rows as replay state and provides **bounded explicit catch-up**, not automatic recovery, delivery certification or a production outbox scheduler. Retain all unsuccessful results and operator-visible categories. A manual-triage incident created with policy gap/unknown impact must not silently acquire a newly calculated SLA because configuration later changes; any re-enrichment command needs a separately defined versioned audit rule preserving original occurrence and earlier decision history.

## Concrete current evidence-integrity concern

`IncidentService.process` binds existing incident by installation/tenant/source/problem ID, but recovery evidence is not checked against the incident's original resource/site/uplink. The source can submit a valid, ready-mapped recovery for the same problem ID on another resource, and the service reports that recovery against the original incident.

A no-file, no-network probe bundled the actual current IncidentService with synthetic in-memory ports. Original incident site/uplinkA, recovery site/uplinkB, same trusted source/problem ID, later valid UTC. Actual result:

```json
{
  "kind": "incident",
  "recoveryObservedAt": "2026-11-27T00:01:00.000Z",
  "mismatchedSiteAndUplink": true,
  "operationalStateUnchanged": true
}
```

This is a recovery evidence association defect, not an established authorisation or closure bypass: operational state remains unchanged. Before recovery feeds durable operational state, require evidence resource/site/uplink identity consistent with the original problem binding; otherwise return a fixed mapping-conflict/manual-review outcome and preserve the conflicting receipt for diagnosis. Apply the rule to updates too, or explicitly specify supported resource remapping with a reviewed audit transition. Matching problem ID alone is insufficient in the current one-uplink incident model. Add a regression proving mismatched recovery cannot become restoration evidence while a valid same-resource recovery remains only an observation.

## Durable operational-state contract recommendation

Current incidents persist immutable creation snapshots with state new/manual_triage. `transitionIncident` is a pure helper, not a durable workflow. Do not overwrite the immutable incident snapshot with successive mutable ownership/state versions or report its original state as current operational state after transitions.

Add a separate tenant/install/incident-scoped operational aggregate. One row contains mutable operational state, version, owner team/assignee, pending handoff, recovery observation reference, restoration validation, resolution/closure timestamps, checklist/gate revision and a bounded command-receipt/audit structure. Initialise from a same-tenant existing selected-SLA incident and retain the immutable SLA identity/hash; changing owner, handoff, remediation, return to NOC or validation never recalculates start/warning/deadline. Manual-triage policy gaps need explicit workflow treatment, not guessed priority defaults.

Each command accepts only validated command UUID, expected aggregate version, action-specific references and observed checklist versions. Trusted actor/team/NOC context is freshly derived server-side from active ISP membership, unexpired grant, stored team membership and tenant configuration. A client-supplied team ID or gatePassed boolean is never sufficient authority. Validate same-tenant active referenced teams/assignees and parent nonpending/lifecycle predicates in the final write, not only preliminary reads.

A single conditional UPDATE should atomically store next state/owner/handoff, version increment, server UTC, safe actor attribution, command fingerprint/result and audit event. Match installation/tenant/incident/expected version and current reference/permission predicates; require exactly one affected row. Replaying the same command UUID with the same fingerprint returns its prior receipt; different content conflicts. A stale expected version must never repeat an external effect even after a bounded receipt view is compacted. Cross-tenant IDs cannot select the row or its referenced object authority.

Forge SQL multi-statement transactions must not be assumed. A separately inserted receipt followed by aggregate UPDATE creates a crash gap; placing authoritative receipt and aggregate change in the same row closes it. A bounded development audit cannot silently evict canonical ownership/closure history: either fail closed at its documented capacity or add a separately reviewed immutable audit-segment/archive protocol. A mere rolling last16 array is not complete historical audit acceptance. Any archive protocol needs deterministic segment IDs/content digest, write-before-CAS pointer advancement and safe duplicate/orphan handling.

Maintain server-time monotonicity against persisted transition/validation/handoff times. Current pure helper only checks now against SLA start; it can otherwise accept resolve time earlier than stored restorationValidatedAt if supplied an earlier clock. New persistence must reject this and must not trust client-provided resolution times. Gate evidence belongs to the same incident/cycle/current checklist revision; recording a recovery timestamp must never automatically satisfy restoration or closure gates. The pending owner retains ownership until explicit target-team acceptance; rejection preserves original ownership. Direct NOC routing and continuous SLA remain intact.

Jira effects need a separate durable intent/result boundary. Do not perform HTTP between an unchecked state read and a later state CAS and call the combination atomic. Persist the intended external action, acquire its lease before HTTP and settle through token/version fencing; ambiguous external success requires reconciliation, not blind reissue. The app's native workflow restrictions must be independently configured/verified for Jira UI, REST and automation paths. Restricting only Forge resolver buttons does not prevent native Jira closure bypass. A local operational aggregate is not proof that native Jira validators/permissions exist.

## JSM timing and ambiguity review

The current create service calculates Retry-After dueAt from the clock **after** receiving the429 response, correcting the earlier response-delay issue. Gateway bounds Retry-After to integer1–3600 seconds; malformed/unsupported values become explicit configuration/manual-review rather than an early retry. Existing local test `schedules Retry-After from response time rather than worker start` covers this behavior.

SQL intent claim sets sending/reconciling and increments attempt counters before HTTP. A live token, matching version and unexpired lease are required for settlement. If an HTTP response arrives after lease expiry, a failed settle leaves sending/reconciling; the next claimant can only reconcile and cannot issue another POST. Zero/incomplete search is never evidence that the original POST failed. These safeguards should remain shared by catch-up and manual actions.

Before production use, bound actual external work within the invocation/runtime budget and retain explicit pending/ambiguous observations. Multiple metadata requests plus create may consume most of the60-second lease; this is a native performance/acceptance gap, not permission to extend leases or claim fast requests without evidence. Mapping uniqueness remains installation/issue across tenants, and a conflict must roll back state+mapping+audit together.

The synthetic JSM DTO deliberately avoids raw monitoring titles/customer payloads. Full persistent Jira linkage, operational state/history, handoffs and actual native workflow enforcement remain mandatory roadmap work. Current SQL/model projection and stored configuration must be incrementally reviewed as new operational references appear. No dependency or scanner rerun is justified merely by session resumption; prior18-versus12 assessment and coverage limitations remain in force.

## Required local tests for the next implementation

Exercise ready receipts whose evidence exists but incident creation failed; existing incident with missing configuration; expired/ambiguous JSM intent; already linked receipt; recovery-before-problem; inactive/foreign source/tenant; individual failure that does not hide later page rows; cursor/sentinel correctness; no network when prerequisites are missing; and concurrent duplicate catch-up retaining one incident/intent/POST. Add the mismatched-resource recovery regression above. For operations, test stale version/command replay/content conflict, nonmember/expired/foreign team denial, handoff owner retention, stale gate revision, clock regression, immutable SLA and atomic receipt+audit after write failure. All are local simulations unless real platform evidence is separately recorded.

## Incremental integration review after implementation

The new orchestration port now validates candidate rows with `object(row)` before UUID projection. The added null-row regression passes alongside the other bounded paging and failure-projection checks. Targeted orchestration, incident-binding and operational service tests pass34 cases across3 files. This is local injected-port evidence, not a scanner or hosted rerun.

The backend evidence-binding correction addresses the reproduced concern above. Durable original problem evidence must be unique and agree with the incident's source/problem/start/site/uplink; its resource ID anchors later recovery/update identity. A current mismatched site/uplink/resource produces CONFLICT after preserving the receipt. Previously stored mismatches are excluded from recovery/update counts, remain durable, and do not poison later valid same-resource recovery. Missing/ambiguous authoritative original evidence fails closed. The SLA and operational state remain unchanged by recovery observations. Final integration should retain these regressions when connecting operational facts.

Operational contracts now use a durable pending envelope for command receipt/audit plus state CAS, followed by idempotent materialisation. The repository contract explicitly requires receipt invisibility until every required projection completes and the matching pending envelope clears. That design avoids silent audit eviction and supports exact-command repair. SQL implementation must enforce it: deterministic scoped projection keys, immutable fingerprint/content equality on duplicate projection, no clearing after a failed audit/history write, and matching-command/version CAS before clear. Do not count a mocked repository that always returns true as proving this atomicity.

`operationCommand` rejects arbitrary actor/gate fields and uses strict existing UUID/text/integer validators. A no-file probe of the actual parser rejected array kind, string/array expected version, caller gatePassed and array target-team ID (five of five). Gate booleans require literal true; values are never coerced from a checkbox-like string. Account/team authority is refreshed before receipt replay, and fingerprints include installation/tenant/account/team/command. Same command UUID with changed content/actor conflicts; other commands cannot proceed past an unresolved pending envelope or unexplained lease. Stored NOC identity is now pinned so configuration changes cannot silently reroute an existing incident.

Return semantics retain departmental ownership while pendingReturn is open. Only configured NOC can explicitly accept/reject, and rejection records a required reason without transfer. Accepted return moves to restoration_validation with previous validation cleared. Incoming monitoring recovery cannot perform that transition. NativeConfirmation remains an internal durable-read contract; runtime resolve/close must stay NOT_READY until a real adapter verifies the exact linked Jira issue, intended operation, expected aggregate/gate version and authoritative confirmation time. An issue ID matching a numeric regex alone is not confirmation.

Outstanding incremental checks communicated to the lead/integration owner:

- Final operation-save SQL must verify the current evidence/facts revision atomically with state CAS. A prior facts()/gate() read plus expected aggregate version alone can accept evidence that became stale between those reads and the write.
- Decode and verify pending envelope identity before projection/replay: receipt command, audit command, result incident, aggregate incident, fingerprint and audit target must agree. The application service currently validates top-level scope/incident; DB input projection must cover the nested fields.
- `accept_handoff` currently has no gateTemplates entry. Define and test whether fresh operational gate/facts are required at acceptance, rather than relying indefinitely on the request-time gate. Fresh stored gate evaluation at the accepting aggregate version is the recommended conservative behavior; rejection should remain available with reason.
- Strictly validate native confirmation issueId as a string/numeric identifier before matching; JavaScript regex test coerces an array such as ["100"] if a malformed internal port returns it. This is future adapter hardening, not a presently reachable native bypass, because the real adapter must currently return no confirmation.

These are concrete adapter/service integration requirements, not claims of passed native workflow enforcement. The lead owns their final disposition and associated regressions before checkpointing the completed operational slice.

## Final local disposition — 2026-11-28

The integrated v005 adapter now checks evidenceCOUNT at final state/gate writes, validates nested receipt/audit/incident/fingerprint identity before materialisation, and repeats active parent/team/engineer/configuration/tier predicates. Fresh handoff acceptance gates and strict native issue-string validation were added. Current concrete native confirmation remainsnull; no closure authority is inferred. Clock rollback regression verifies command and gate writes reject earlier time while projections do not regress logical timestamps. Administrator projection-only repair is exposed with stored command selection and original audit attribution, distinct from replaying a state transition. Peer reviews and local tests remain simulations; native gates are unchanged.
