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
