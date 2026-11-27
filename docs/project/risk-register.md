# Risk register — current review 2026-11-26

| ID    | Risk / likelihood / impact                                                  | Mitigation and owner                                                                                | Exit evidence / status                                        |
| ----- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| RK-01 | Development deployed/installed; actual runtime pending; certain / high      | Preserve real ID; official lint passed; require owner runtime evidence and post-test usage review   | LH-013; open                                                  |
| RK-02 | Cross-ISP data access; medium / critical                                    | Tech lead enforces trusted context, tenant predicates/reference checks and negative tests           | Sprint 1/7 two-tenant/two-install tests; open                 |
| RK-03 | Jira create ambiguity produces duplicate incident; medium / high            | Persist initial marker, reconcile exact candidates and hold unknown outcome for review              | Sprint 4 failure injection/live search; open                  |
| RK-04 | SQL partial writes/concurrency/migration assumptions; medium / high         | No session transaction assumption, single-statement claims, inbox/sweep repair and schema readiness | Live SQL migration/claim tests; open                          |
| RK-05 | Source secret compromise/replay; medium / high                              | Per-source bearer, rotation/revocation, bounded timestamps, durable dedupe, minimal scope           | Sprint 2 negative/rotation tests; open                        |
| RK-06 | Forge/JSM billing above allowance; medium / high                            | Minimal development smoke only; owner monitors usage/alerts; no paid provisioning                   | Billing review and usage evidence; open                       |
| RK-07 | Native SLA differs from app deadline; high / medium                         | Separate authorities and display reconciliation drift; approve 24/7 assumption                      | ADR-0009 owner + live metric test; open                       |
| RK-08 | Notification misconfiguration exposes info or fails delivery; medium / high | Aggregate-only content, safe internal/public workflow and recipient matrix                          | Synthetic notification logs; open                             |
| RK-09 | Directory consent/unattended flow unavailable; medium / medium              | Provider-specific verification; manual fallback; no external auth replacement                       | Sprint 6 consent/revocation tests; open                       |
| RK-10 | Deadline pressure across ten slices; high / high                            | Re-estimate each exit, protect MVP and defer stretch, freeze release 19 Dec                         | Owner capacity/scope review; open                             |
| RK-11 | Dependency advisory/peer mismatch; observed / high                          | Compatible patches, React 18, exact lockfile, audit/bundle review                                   | LH-014 open; development-only residual risk accepted by owner |
| RK-12 | Scheduled warnings late / retries expire; high / medium                     | UTC-derived display, bounded sweep, durable backlog and manual review; no precise scheduler promise | Stalled-state/retry exhaustion tests; open                    |
| RK-13 | Judge cannot reproduce setup; medium / high                                 | Fresh-site install with synthetic seed/fixture instructions and actual JSM                          | Sprint 8/9 independent exercise; open                         |
| RK-14 | Confidential data/IP enters fixtures; low / critical                        | Synthetic-only policy, staged/history/recording review                                              | Each PR and pre-submission review; ongoing                    |
| RK-15 | Platform docs/dependencies change; medium / medium                          | Dated official evidence, recheck before introducing capability or releasing                         | Capability matrix and live gates; ongoing                     |

Risk owners are the project owner for consent/budget/eligibility and the technical lead for implementation/verification. These labels identify responsibilities, not configured assignees in Jira.

## Sprint 0.5 risk update — 2026-11-25

| ID           | Risk                                                                 | Mitigation / owner                                                                                                                | Exit evidence / status                                                        |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| RK-11 update | Eight affected packages remain; no supported compatible upstream fix | Per-package and bundle assessment; no override/downgrade; owner explicitly dispositions residual risk before deployment/release   | dependency-security-assessment.md; open deployment/release gate               |
| RK-16        | Native Jira close/automation bypasses app validation                 | Site workflow restriction plus live native UI/REST/automation tests; technical lead + Jira admin/owner choose supported mechanism | Sprint 4/7 acceptance blocked until proven; reconciliation alone insufficient |
| RK-17        | Handoff race or missing audit creates owner gap                      | Conditional incident version/pointer, origin/receiver accountability and bounded pending-envelope repair                          | Sprint 3/4 fault/race tests; designed only                                    |
| RK-18        | Operational expansion exceeds remaining calendar                     | Fixed workflow, basic transfers, reuse Jira, defer extra timers/designer/Zoho; owner re-estimates capacity                        | Revised roadmap/tracking; high/high, open                                     |
| RK-19        | Unknown inventory hides a legitimate outage                          | Visible durable manual triage with unknown impact and original start                                                              | Sprint 2/3 intake tests; designed only                                        |

No risk disposition or proposed ADR is silently accepted. Registration is now owner-completed; credential-store/site/runtime acceptance remains RK-01; authenticated GitHub CLI does not remove remote/push authorisation gate. Conceptual alignment uses only owner-supplied operational requirements, never employer material.

## Sprint 0.6 risk update

RK-01 registration component resolved by owner evidence and genuine manifest ID; CLI whoami/environments/install-list/lint remain inaccessible here (exit 1), not an owner-login failure. RK-06 remains open: terms accepted, payment/recipients/usage console not inspected, no hard cap established. RK-11/LH-014 dependency findings remain open at eight packages, five high/three moderate; proposed development-only disposition in dependency-security-assessment.md is unaccepted, expires 2026-12-03 if adopted, production still blocked. No risk accepted by agent.

New tooling-boundary risk: third-party agent examples can cause false application gate failures or unintended imports. Mitigated locally by global ESLint and explicit Prettier ignores, existing positive TS/test/build entrypoints, local-only Git policy and staged review. These are not secret-scanning exclusions. FSRT/OpenGrep complete with zero findings but limited scanner scope and no deployed evidence; future features require new security routing. Owner confirms an appropriate JSM development site exists; exact target and security exception/paid-exposure/promotion decisions remain outstanding.

## Final foundation acceptance update — 2026-11-26

The project owner explicitly authorises development deployment/install on the confirmed owner-controlled Jira site, public GitHub source publication after review, push/PR/CI and conditional history-preserving merge. No staging/production deployment, app distribution, paid provisioning, licence selection or Sprint 1 start is authorised. LH-014 is accepted with documented residual risk for isolated synthetic development only; it remains open, not remediated. See dependency-security-assessment.md and foundation-acceptance-report.md for current evidence and remaining gates. Earlier permission and registration blockers are historical.

RK-01: authenticated elevated access resolved the sandbox blocker; development deploy/install passed, actual runtime pending. RK-06: dated owner zero-usage/charges baseline recorded; post-test usage pending. RK-11: eight affected packages remain; owner accepts isolated development only under the documented conditions; staging/production reassessment mandatory. RK-14: current publication is **blocked** by historical personal author metadata and a workspace path; owner explicitly declined publication and history rewriting. No remote/push/PR/merge may proceed until a new owner decision. No credentials were found by bounded pattern review; scanner limitations remain.

## Owner-authorised privacy cleanup and publication continuation — 2026-11-26

The temporary publication hold is superseded by explicit owner approval to correct unpublished author/committer emails and equivalent documentation-only privacy details. Private recovery bundle, original refs, complete old/new commit mapping and redaction record are retained outside the repository. All application/configuration trees, commit messages/names/timestamps and branch relationships are verified unchanged except approved documentation privacy/hash-reference corrections. Both branches are consistent; intended metadata has no Gmail address. Repeated history/current-source review passes. Public repo/push/PR/CI are authorised to continue; runtime/CI remain mandatory before conditional merge. No force push, backup publication or next sprint.

## Focused diagnostic correction — 2026-11-26

The prior UI incorrectly equated a resolved invocation with a valid status response. Corrected by explicit runtime validation, public-field projection and fail-closed diagnostics with negative tests. No tenant-sensitive backend is introduced. LH-014 retains its existing isolated-development-only disposition; production stays blocked. Actual diagnostic/Console confirmation remains pending. Host light/dark comparison remains unverified; deferral to Sprint 5 is proposed and needs owner approval. No additional sprint.

## Final runtime owner disposition — 2026-11-26

Actual installed diagnostic/contract/UUIDv4 success matched independently to backend.status at 08:00:25.634Z. No errors in the queried backend window. Earlier browser Console host/content-script/network-change noise is not globally resolved; owner stable-connection scoped Light House iframe retry passes without app iframe errors. Host light/dark comparison explicitly deferred to Sprint 5 as unverified. No remaining mandatory app runtime blocker for foundation merge; final CI/protection still apply. LH-014 remains open under existing isolated-development-only acceptance; staging/production security blocked. No new sprint or operational integration.

## Sprint 1 current risks — 2026-11-26

| Risk                           | Disposition / next gate                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LH-014 changed exposure        | Three existing advisory roots remain; API/SQL/Events add affected parent paths. Foundation acceptance does not transfer; obtain explicit reassessed development disposition before deployment.            |
| Forge SQL runtime              | Actual DDL/collation/native duplicate/affectedRows/retry/concurrency/async/repair compatibility is unverified. Local simulation is not acceptance.                                                        |
| Official lint                  | Final explicit-development lint reports zero errors/warnings and one MAJOR_VERSION_RULE approval (exit 1). Owner major-upgrade authorisation is still required; earlier timeouts are historical attempts. |
| Installation isolation         | Two-database simulation only; no second authorised installation. Record unavailable evidence, never manufacture a pass.                                                                                   |
| Durable admission availability | A partial mutation deliberately blocks later writes until an administrator repairs the stored intent. No silent expiry/abandonment.                                                                       |
| Configuration limits           | Membership selection caps at 50; per-tier policies cap below 100; open-ended published policies need a future explicit supersession operation. Full administration remains later scope.                   |
| Retention/operational policy   | No cleanup runs; owner retention, SLA clock/start/impact/reopen and project licence decisions remain outstanding.                                                                                         |
| Scanner limitations            | FSRT reports no actual source path; OpenGrep/manual review cover source but do not prove runtime security or absence of vulnerabilities.                                                                  |
| Publication                    | Branch is local only; publication, new CI, review and merge remain separate authorised gates. No force push/history rewrite.                                                                              |

Parent-retirement/child-creation write skew identified during review is addressed by the tenant mutation admission primitive and concurrent local regression; live verification is still required.

## Independent Sprint 1 review — 2026-11-26

See [owner decision package](sprint-1-readiness-review.md). LH-014: no new GHSA roots, but API/Events/SQL add three inherited moderate package findings and changed persistence/permission exposure; renewed development-only acceptance remains an owner decision. Native SQL compatibility, official packaging, real consumption and genuine second-installation isolation remain open. Proposed 5,000-request session limit is a manual planning control, not an enforced spending cap. Current probe covers one controlled partial-write boundary; additional live fault stages require reviewed development-only instrumentation. No additional site/install/billing or publication authorisation is inferred.

## Current authorised development risk boundary — 2026-11-26

Owner renewed the exact Sprint 1 LH-014 exception for the existing development installation and synthetic acceptance only. Five high/six moderate findings remain unresolved; no new advisory identifiers. SQL/scope/major upgrade and 5,000-request internal session budget are approved. Missing live metrics, native SQL acceptance and genuine second-installation isolation remain evidence risks. Additional installations/dependency changes do not inherit this exception. Staging/production and final merge remain blocked.

## Read-only diagnostic preparation — 2026-11-26

Checkpoint/metadata visibility remains an evidence gap. The diagnostic is guarded by trusted actor, Jira global ADMINISTER and DEVELOPMENT; unsupported returned names/values and all arbitrary SDK error content are redacted. List failure leaves actual/missing names unknown; SELECT failure leaves presence unknown. Non-ready metadata is observable without bootstrapping access or changing records. One click uses two SQL reads and one permission check, with no polling/retry; hosted usage applies. Tunnel connectivity/native SQL behaviour remain unverified and deployment requires separate approval. Existing dependency findings and missing runtime/two-installation evidence remain open. Remove temporary diagnostics after resolution; no repair or Sprint 2 is authorised.

## Development tunnel observation update — 2026-11-26

Owner confirms operational tunnel, updated diagnostic button, valid health/Bridge contract and normal ready/v1 schema display. This supersedes tunnel-connectivity uncertainty for the observed session only. Full diagnostic checkpoint/metadata output and independent new health-log correlation remain pending. No authorised memberships are reported; generic inventory unavailability is not SQL error attribution. Historical HTTP 400 cause remains unknown, and no new migration/bootstrap/seed occurred. Write hold and remaining native/two-installation/dependency gates persist.

## Native readiness and existing-state update — 2026-11-26

Owner native tunnel diagnostic closes named-checkpoint and exact ready/numeric-v1 visibility gaps for DEVELOPMENT. It does not close rerun/retry/concurrency/repair, inventory persistence/idempotency, second-installation or usage/dependency gates. Current Lantern Fibre admin display supersedes earlier no-membership report; fresh authorised listing and actual row baseline are required before mutations. Generic success text does not show seed state. UI cannot expose tenant pending intent/receipt count; use private Console evidence where available and record unavailable data as a gap. Avoid seed/bootstrap as diagnostics: they can repair/update stored state. Historical HTTP 400 cause remains unverified. No new deployment or Sprint 2.

Runtime follow-up (2026-11-26): rejected frontend invocation remains unresolved despite 10/10 successful invocations in the supplied 24-hour window. Failed-attempt times/trace linkage and remote tunnel/browser state unavailable. Most likely class is routing/delivery; stale registration and authentication remain hypotheses. Real SDK/local Forge bundle health succeeds; a distinct pre-existing external-SDK smoke artifact cannot be directly required due to default-import interoperability and is not deployed-runtime evidence. Local sanitised diagnostics improve attribution; supported controlled tunnel cleanup is the specific next correction, without deployment or SQL changes. LH-014 remains unchanged.

## Native hosted inventory investigation — 2026-11-26

Hosted health accepted at 19:02:04.659Z; earlier routing/transport next actions superseded for this capture. Inventory handled UNAVAILABLE matches hosted processing.failed at 19:02:31.735Z. Current logger discards stage/SQL error categories; originating exception and persisted inventory/intents/receipts remain unknown. Bound LIMIT is an unverified candidate. Two mock-SDK tests establish attribution ambiguity, not native error cause. LH-014 and remaining native/review/merge gates stay open. See [investigation](../operations/sprint-1-inventory-investigation.md).

### Inventory telemetry evidence risk — 2026-11-26

Fixed-stage list instrumentation addresses attribution loss without changing SQL or persisted state. LIMIT placeholder support remains unknown; a parser error alone would not identify the rejected construct. Use first failing stage and exact allowlisted code, then a separately reviewed bounded comparison if needed. Logs never expose error messages/SQL parameters/identities. Lifecycle and expiry checks execute inside the existing membership SQL and cannot be separated further without changing execution. Resolver completion is callback-local; browser delivery requires native capture. Existing LH-014 development-only advisory disposition persists; no staging/production acceptance.

## DEVELOPMENT 3.2.0 UUID attribution — 2026-11-26

Supplied inventory UUID 878d3b6f-6fec-4e2d-bb07-829509844583 is traced: first failure inventory.sql at 19:29:19.693Z, SQL_ERROR / SQL_EXECUTION_ERROR / ER_WRONG_ARGUMENTS. Readiness, membership, authorisation, parameters and query construction succeed; mapping/response stages are not reached. resolver.completion repeats the original failure. Health UUID 895938f9-2eff-4e56-8d47-7a3c0265dd2b independently matches success at 19:28:18.546Z. This supersedes pending-UUID/unknown-stage instructions above. LIMIT binding is the leading source-based diagnosis, not conclusively distinguished from another argument defect inside the SELECT/driver. Proposed safe-integer 1–51 literal LIMIT with bound tenant/cursor and unchanged paging/security is documented for review, not implemented or deployed. No mutation or repeated UI test; persisted baseline and remaining native gates remain open. See [investigation](../operations/sprint-1-inventory-investigation.md).

## Pagination correction quality blocker — 2026-11-26

Local correction is unvalidated: required TS2345 test-spy typing failure stops delivery; tests, coverage and build not reached. Official Forge lint secure-login access is also blocked in sandbox. Do not deploy this worktree. Existing eleven dependency findings retain development-only disposition, with no production acceptance. Bound LIMIT remains the leading hypothesis until native same-SELECT success; no runtime proof or persisted seed state inferred. See investigation/audit.

## Resumed pagination quality result — 2026-11-26

Supersedes the test-spy blocker above: run<T> remains generic through a wrapper and separate stage spy; no production interface weakened. All 148 tests, coverage, build and local validation pass; official Forge lint retry passes. The restricted credential-store failure and elevated platform timeout are external execution failures, not application lint findings. Fresh-cache full/production audits retain eleven findings (5 high/6 moderate), the same three GHSA roots and exact lockfile covered by the owner's DEVELOPMENT-only disposition. Default-cache reports seventeen inherited package findings as previously observed; retain the discrepancy, not a claim of remediation. Hosted LIMIT diagnosis remains provisional until correlation-linked native SQL/response success. Browser host is unavailable; no UI execution can be fabricated. See latest investigation/audit for deployment/postflight.

## Automated native acceptance risks — 2026-11-26

Authentication state is credential material: isolate in ignored `e2e/.local/auth/`, directories 0700/files 0600/umask 0077, owner checks, no-follow reads, atomic writes and no committed profiles/cookies. Disable binary screenshots/traces/videos/HAR and arbitrary browser/error/network capture. Curated reports project only expected synthetic fields, redact sensitive patterns, escape HTML and stay private; redaction is not authorisation to publish them. Direct package/browser installation is development-only with a separate lock/audit. Hosted log propagation, truncation, concurrent traffic and clock differences can prevent attribution; timed matches remain candidates, not fabricated UUID proof. Missing login and headed sandbox restrictions are external acceptance blockers, not application failures. The local browser fixture found and resolved a nested-select locator incompatibility using exact named comboboxes. Application runtime/dependency/permission surface is unchanged by this harness; existing LH-014 risk remains open. No deployment or database mutation permitted for tooling acceptance.

## Authentication workflow and audit discrepancy — 2026-11-26

The owner's generic startup error has no recoverable stage evidence. Corrected doctor must run on that desktop before selecting a remedy; agent browser launch restrictions are separate. Never weaken Chromium sandbox or export session state to troubleshoot. A fresh root audit reports 17 findings (11 high/6 moderate), exceeding the earlier eleven-findings record; no package or lockfile changes caused by this correction. E2E audit remains zero. Reassess the exact current advisory tree before any separately authorised publication/deployment; previous eleven-finding disposition does not automatically cover new advisories.

## Browser compatibility correction — 2026-11-26

Owner-confirmed downloaded Chromium sandbox failure requires installed Chrome Stable channel on this workstation. Correct channel configuration does not itself prove browser startup; verify with doctor, then reuse private state or owner MFA as needed. Keep sandboxing, non-root execution and existing private-artifact controls. No AppArmor/sysctl workaround or personal profile. Audit count varies by cache (17 default / 11 fresh) with unchanged lock and three identical advisory IDs; conservatively retain the higher observed count, not a claim of new advisory or remediation. LH-014 and hosted acceptance remain open.

## Native correction risk disposition — 2026-11-26

Three-kind inventory failure is resolved functionally on DEVELOPMENT 3.3.0; strong runtime evidence supports the application LIMIT-binding diagnosis. Eight complete hosted list traces are independently verified, but type-specific UUID attribution is unmatched because exact click intervals are absent. No provider-wide restriction or browser delivery proof is inferred from backend completion alone. Five synthetic persisted rows are verified; pending intents/receipts, other kinds, complete fixtures/replay, role/isolation/CAS/policy/recovery and actual usage remain partial/untested. Probe presence does not prove repair. Browser launch is resolved by owner evidence; authentication restrictions still block hosted automation. Existing dependency audit risk, second-installation authorisation, licence and final publication/review/merge gates remain open. Follow the [completion plan](sprint-1-execution-report.md#consolidated-sprint-1-completion-plan--2026-11-26), with no repeated accepted checks or speculative deployment.

## Phase A customers delivery/attribution risk — 2026-11-27

Two owner-observed customers Bridge rejections remain unresolved despite independently available health/schema/admin membership. Nearby successful backend lifecycles are entity-unmatched; neither their success nor missing errors proves customer delivery or pre-resolver failure. Customer payload uses the same scalar request/shared response path as other kinds; local regressions are not hosted acceptance. Keep earlier three-kind acceptance separate; no SQL diagnosis, corrective deployment, mutation or authentication workaround justified. Owner continues remaining read-only kinds; capture existing times/results when available. See inventory investigation.

## Native baseline residual risks — 2026-11-27 (current)

All eleven UI retrieval kinds pass; prior customers rejections remain historical, cause unverified and no correction claimed. Seven precise-window backend candidates are temporal evidence, not displayed UUIDs. team_memberships explicit serialization-success telemetry is missing despite later completion/UI success. Current Console browser access is unavailable; schema details, clean intents, receipt uniqueness and current resource consumption are unknown, never zero or failures. Hold Phase B writes until fresh baseline and one bounded approval. Browser grant form lacks expiry and grant-version reader; operators see generic config editors but backend requires admin. Do not assume UI hiding, safe revocation or unsupported fault tests. Retain all independent second-installation, LH-014, licence, publication/review/merge and Sprint 2 boundaries.

## Conditional approval does not waive preflight — 2026-11-27

Phase B is owner-approved, but browser host remains unavailable and usage/state/receipt/identity/headroom evidence is missing. No mutations initiated. Independent seed/repair while identities are unconfirmed is expressly prohibited by the latest owner request. Three populated snapshots are needed for meaningful idempotency/reload evidence; revised60-list180-call allocation reduces uncertainty reserve by105, preserving2,000 cap. Console lag, unsupported Table data or absent version reader can block execution without indicating an app failure. Do not deploy, change site classification or investigate authentication to overcome them.

## Partitioned gates and delayed metering — 2026-11-27

Proposed B.1 admin gate removes unnecessary dependency on unavailable V/O only after revised review/approval. B.2 consent/RBAC/expiry/revocation/access criteria remain. Shared1,750+250=2,000 reservation under cumulative5,000;286 display leaves nominal2,714 prior-unmetered slack, not measured U. Unknown lag/untracked activity cannot be covered by invented buffer or reset. Sample10-row table/five receipts and clean probe do not prove exhaustive state or recovery. Clean migration rerun is not partial retry. No faults/probe re-arm/driver/deploy/second installation authorised; no mutations in review.

## Development progression versus release risk — 2026-11-27

Recommend implementation-complete locally / release acceptance outstanding under ADR-0017. No confirmed prerequisite architectural/auth/mutation defect found in bounded review; preserve controls and151-test suite. Native RBAC/expiry/real-installation isolation and other R-01–R-14 remain mandatory release gates; unavailable identities may block final release, not unrelated authorised local Sprint2 coding. Any actual bypass/tenant leak/corruption/test failure promotes affected scope immediately to D/DEP blocker.

Current PR2 head CI green does not cover dirty/untracked final corrections/harness/docs; exact-head CI/review and owner authority block merge. Dependency advisories remain scoped development risk, not release acceptance. Latest deterministic scan incomplete (FSRT source coverage unknown, OpenGrep not_run), explicitly retained security evidence gap. No diagnostic/tunnel/auth expansion justified solely to perfect reports. B.1 remains separately bounded/authorised with recorded286 lag reconciliation; no writes during this reassessment.

## LH-103 local start — 2026-11-27

Supported KVS SDK retrieval is unavailable (ETIMEDOUT); concrete secret binding/runtime registration is blocked, not replaced by legacy API. Local source/receipt projections do not provide deployed triage UI. Credential partial-write reconciliation, bounded cleanup/source pagination and migration caller serialization remain incomplete. No ingress is exposed, so this work has not changed the deployed attack surface. Complete implementation review and native SQL/KVS/queue/transport/isolation gates before any deployment/release claim; see ADR-0018 and Sprint2 report. Sprint1 native/security/licence backlog remains unchanged.

## LH-103 current disposition — 2026-11-27

KVS package retrieval blocker resolved via supported external registry permissions; local runtime/UI/cleanup/source pagination now implemented, superseding earlier local-start gaps. Full Forge lint timed out, native SQL/KVS/queue/Zabbix/role/isolation not exercised, scanners did not run successfully. Public ingress and storage scope remain undeployed; new exposure/advisory risk must be separately approved for DEVELOPMENT. Detailed bounded proposal and stops: ../operations/sprint-2-development-approval.md.
