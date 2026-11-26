# Regression matrix

| ID   | Scenario                                                      | Level                          | Sprint / status    | Evidence required                                        |
| ---- | ------------------------------------------------------------- | ------------------------------ | ------------------ | -------------------------------------------------------- |
| R-01 | Correct product/stage and unconfigured integrations           | unit                           | 0 implemented      | foundation test + shell render                           |
| R-02 | Internal UUID correlation and secret-safe logs/errors         | unit                           | 0 implemented      | unique UUID and runtime extra-field stripping            |
| R-03 | Resolver registration and response                            | mocked SDK unit                | 0 implemented      | getStatus wiring test; not runtime                       |
| R-04 | Bridge loading/success/failure/unmount                        | jsdom mocked unit              | 0 implemented      | App tests; not installed UI                              |
| R-05 | Real Forge module/Bridge/CSP/theme                            | installed UI                   | owner gate blocked | development installation record                          |
| R-06 | Migration retry, optimistic claim, same-install ISP isolation | live SQL integration           | 1 planned          | two-tenant/installation negative tests                   |
| R-07 | Auth, rotation, malformed/oversized/replayed Zabbix payload   | contract + installed ingress   | 2 planned          | pinned source version, wrong tenant and bad secret cases |
| R-08 | Impact, unknown/failover and policy effective-time boundaries | unit                           | 3 planned          | distinct customer count + injected UTC clock             |
| R-09 | Concurrent duplicates and recovery before problem             | integration                    | 4 planned          | single incident/issue under overlap                      |
| R-10 | Jira commit then timeout, search lag, rate limit              | failure injection + live JSM   | 4 planned          | no blind retry, reconciliation/manual review evidence    |
| R-11 | Native SLA and notification visibility                        | live JSM                       | 4 planned          | configured metric/calendar, synthetic recipient logs     |
| R-12 | Administrative permissions and UI tenant switches             | negative integration + browser | 5/7 planned        | forged invoke and stale role denied                      |
| R-13 | Directory consent/revocation/ambiguity/manual fallback        | adapter integration            | 6 planned          | separate subjects/account IDs and no access grants       |
| R-14 | Clean judge install + complete synthetic scenario             | release end-to-end             | 8/9 planned        | actual installation link and replayable instructions     |

A planned row is not test coverage. Audit records executable counts only.

## Planned operational workflow additions (Sprint 0.5 design)

| Case | Required assertion                                                                                   | Sprint / status                    |
| ---- | ---------------------------------------------------------------------------------------------------- | ---------------------------------- |
| W-01 | Forged actor/state/gate and viewer/revoked/cross-tenant mutation denied                              | 3/4 planned                        |
| W-02 | Concurrent accept/reject/return permits one outcome; origin/receiver owns until accepted transfer    | 4 planned                          |
| W-03 | Rejection reason/evidence/actions required; return rejection preserves receiver accountability       | 4 planned                          |
| W-04 | Direct NOC remediation reaches validation/closure with no handoff                                    | 3/4/7 planned                      |
| W-05 | Team changes and rejected/returned transfers retain original SLA and snapshots                       | 3/4 planned                        |
| W-06 | Recovery evidence alone, stale validation, missing diagnostics and active handoff cannot close       | 7 planned                          |
| W-07 | Native Jira UI/REST/automation/bulk closure cannot bypass gate; drift/timeout reconciled             | 4/7 real site required             |
| W-08 | Authenticated unmapped event remains visible, unknown count never zero; original start preserved     | 2/3 planned                        |
| W-09 | Fault after incident write before handoff/audit materialisation blocks next command and repairs once | 1 primitive; 3/4 behaviour planned |
| W-10 | Evidence HTML/URL/cross-tenant attachment cannot execute/fetch/leak data                             | 4/5/7 planned                      |

## Sprint 1 executed local regressions — 2026-11-26

| Case                   | Implemented evidence                                                                                                                               | Runtime boundary                                                |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Schema/order/readiness | Immutable DDL digest/order, absent/wrong-install/environment/version denial, mocked retry/checkpoints                                              | Live TiDB and async acceptance pending                          |
| Tenant security        | Two ISP tenants, direct-ID/reference injection denial, viewer/operator/admin, revocation/expiry, trusted identity and global permission denial     | Genuine second-installation unavailable                         |
| Inventory              | Creates/retrieves, binary-case natural identifiers, uniqueness, parent retirement, invalid backup/self/cross-site protection, independent services | Local adapted SQLite                                            |
| Configuration          | SLA positive duration/zero warning/boundaries, publication immutability/overlap/version claims, manual assignee versus access grant                | No SLA execution                                                |
| Concurrency/repair     | Stale writes, tenant admission, injected pre-target/receipt/policy failures, concurrent replay/original and old-completion isolation               | No transaction guarantee; actual SQL pending                    |
| Seed/bounds            | Four-record batches, deterministic relations, idempotent reruns with no writes, unknown service mapping, query budget, max pages                   | No real ISP data                                                |
| UI/foundation          | Explicit loading/empty/error/conflict/validation, selection/configuration/grants, repair and all foundation diagnostic regressions                 | jsdom/mock Bridge; installed visual comparison remains deferred |

Historical R-05 is now foundation-accepted for diagnostics/Bridge; actual visual theme comparison remains deferred to Sprint 5. R-06 has local evidence above and an open live gate. No mocked result closes it.
