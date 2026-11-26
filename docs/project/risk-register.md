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
