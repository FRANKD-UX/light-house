# Light House autonomous execution state

Updated 2026-11-27. Programme objective remains unfinished; native goal currently reports **usageLimited**, not complete. Owner said proceed; available lead execution is preserving and validating the in-progress checkpoint without replacement agents. The standing owner mandate authorises remaining canonical local implementation and native specialist delegation. ADR-0017 and external-action gates remain intact.

## Objective and checkpoints

Deliver authenticated Zabbix → durable intake → Border Control → enrichment/customer impact → immutable SLA → idempotent JSM creation → operational workspace, then all mandatory roadmap requirements and submission preparation. No runtime AI, external backend, real customer traffic or notification service.

- Sprint1 checkpoint: `e1d12ffdb57910ba7c5873294ea6f9aaeb04d044`, implementation-complete locally; R-01–R-14 release acceptance remains open.
- Sprint2 implementation: `2b97545fe87e5d3d371ab2982da7e41b7614d834`, tree `0e5623879a3a05cb09e3d9ef7703148c3b606c25`.
- Preserved Sprint2 hosted documentation: `3236eb7`, twelve documentation files committed locally; no runtime change. DEVELOPMENT major4/install/health evidence is in operations/sprint-2-hosted-acceptance.md. Do not repeat deployment/health merely to resume.
- Integrated local implementation: `a16a5ba1238aa7ffae7bad505b8847bc980bd8b3`,295 tests validated; full POC integration test/native acceptance still pending.
- Current branch: `sprint-3/incident-orchestration`, same existing `/tmp/light-house-sprint1` worktree. Other existing main worktree is untouched. No additional worktree was created.

## Active assignments and integration

Four total slots including lead; three specialist subagents, no duplicate writers. Backend owns new domain/incidents + application/incidents + incidents unit tests. Integration owns application/jsm + infrastructure/jsm + jsm unit tests + jsm-programme-contract.md. Security owns programme-security-assessment.md and ignored scanner outputs. Lead owns SQL/Forge integration, existing shared contracts/configuration/docs/manifest/lock. Integration specialist subsequently implemented the incident UI and backend specialist supplied SQL/runtime quality tests; security specialist implemented v004 SQL and reviewed integration. Agents must return exact files, checks, risks and remaining integration; no independent shared-file commits.

Prior successful baseline:203 application tests/23 files,20 harness checks, builds/local manifest, dry-run. All source/manifest/locks unchanged at startup; prior docs now preserved. Integrated milestone npm run validate now exits0:295 tests/30 files, coverage96.61 statements/94.87 branches/97.69 functions/97.68 lines, strict types/lint/build/local manifest all pass. Harness20 and webhook dry-run pass. All203 baseline retained; no root dependency/immutable migration changes. Validated implementation checkpoint: `a16a5ba1238aa7ffae7bad505b8847bc980bd8b3` (52 files; local only). Source commit follows preserved documentation3236eb7; existing deployment remains2b97545.

## Dependency graph and execution status

| Task                                   | Status                                                 | Dependencies / gate                                                                  |
| -------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| Foundation/Sprint1 local contracts     | Completed with local evidence                          | Native release matrix remains mandatory                                              |
| Sprint2 local intake                   | Completed locally; deployed/health accepted            | v002/source/HTTP/worker native acceptance outstanding                                |
| Dependency18-versus12 assessment       | Assessment complete; current conservative18 retained   | Unchanged-lock controlled audit/scanner/runtime graph evidence                       |
| Hosted Sprint2 preflight/session       | External-authorisation/native dependent                | Fresh usage, pending/readback, explicit risk/native scope; no new authority inferred |
| Incident impact/SLA/workflow core      | Implemented locally; aggregate validated295/30         | Trusted monitoring/inventory contracts; configurable proposed business defaults      |
| Durable incident SQL/worker glue       | Integrated locally; aggregate validated295/30          | Lead integration; additive v003 local only                                           |
| Idempotent JSM creation components     | Implemented locally; aggregate validated295/30         | Exact official REST contracts and durable intent ports                               |
| JSM runtime orchestration              | Implementation dependent then external authorisation   | Core + durable intent + reviewed scopes/configuration/native permissions             |
| Operational workspace                  | Initial workspace implemented; broader Sprint5 pending | Incident read/command contracts; native themes separate acceptance                   |
| Identity adapters/manual fallback      | Ready independent after POC                            | No replacement of Atlassian authentication; provider consent external                |
| Recovery/guarded closure/native bypass | Implementation + native dependent                      | Immutable workflow and actual Jira enforcement                                       |
| Release candidate                      | Native/security/owner dependent                        | All R-01–R-14, licence, final-head CI/review/isolation and release acceptance        |
| Demonstration/submission preparation   | Ready independent                                      | Actual demo evidence follows integrated native flow; publishing owner gate           |

## External boundaries and resources

No deployment/tunnel/install, SQL migration, source/secret provisioning, URL generation, JSM write, push/merge/distribution or final submission executed under this programme start. Existing approved scope remains conditional. Shared additional2,000/cumulative5,000 SQL request limits; historical286 is not verified headroom. Proposed600 Sprint2 reservation must be carved out of remaining shared reservations, not added. Fresh metering/data-through/unmetered bound/in-flight/pending/receipt evidence required; see hosted runbook. No private target/session/credential files read by agents.

Security: current default full/prod audit18(11high/7moderate), previous fresh12(5high/7moderate); controlled unchanged-lock default/fresh cache experiments reproduce18 versus12; same3 roots/six inherited wrappers. Exact stale calculation cause unproven. See programme-security-assessment.md. Existing release/dependency/licence/native roles/second-installation/retention/scanner gaps remain. Separate exact-artifact review before any deployment of new code.

## Supported execution and recovery

Installed Codex CLI0.172.0, native Goal tool successfully created the active programme goal in this session. Available native collaboration tools are in use; environment limit four total agents supersedes a larger requested maximum. No global model/sandbox/approval/MCP setting changed. Project agent definitions are local ignored tooling, not runtime or CI dependencies. Official manual checked2026-11-27. Forge/ADS MCP not exposed in current tool inventory; only security-review SKILL.md installed at project path; unavailable builder/debugger/cost references recorded, no installation performed.

Native get_goal now reports usageLimited. Two specialist turns failed with client text: “try again at Nov28th,2026 12:50 AM”; timezone and weekly/five-hour category were not specified. Do not infer SAST or a weekly reset. No complete account usage/reset API is exposed here. Do not fabricate remaining allowance or classify every interruption as five-hour exhaustion. No automatic reset scheduler or daemon has been established. Native goal is active; automatic post-exit/reset restart is unverified. On interruption resume this same session with `codex resume 01a21e48-210e-72c3-9d58-9f2f85b14cb8` (or select this session in the client), read this file, verify Git/worktree/agent state and continue the next action. No master prompt resubmission needed. Do not purchase credits, spawn agents to evade a limit or run tight polling.

Exact next action: after supported goal usage resumes, implement missing full local vertical-slice simulation (tests/integration/poc-orchestration.test.ts was assigned but NOT created before the security agent hit its limit), then durable downstream catch-up and operational workflow persistence. Record real outcomes, inspect proposed commit for secrets, checkpoint and continue the next authorised local milestone. Do not stop solely because a sprint or specialist finishes.

## Interrupted specialist state

Backend: completed/frozen31 core+9 SQL+10 mocked runtime tests, no commit. Integration: completed/frozen21 JSM+11 UI tests and contract docs, no commit. Security: dependency assessment, v004 repository10 SQL tests and bounded integration review complete; newly assigned full POC simulation never created (verified absent). Both security/integration reported usage limits; no replacement subagent launched. Existing source/tests/docs retained. Native goal status confirmed via get_goal; do not mark complete or paused through update_goal.

Project .codex config and six role TOMLs were created through narrowly approved protected-directory write; no previous project config existed, user/global MCP/permissions untouched. All seven files parse as TOML and are Git-ignored. Native collaboration is verified; role-file loading in a newly started CLI session is not separately executed. `codex --strict-config features list` is unsupported in this CLI; no settings were changed to work around it. Official schema/manual used, no unverified reset automation configured.
