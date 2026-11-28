# Sprint 5 recovery, preservation and POC proposal

Date: 2026-11-28. Current scope is recovery and continuation of the existing Sprint 5 POC. No Sprint 6. The original main worktree is untouched. All proposed remote/hosted mutations remain unauthorised.

## Recovery and durable checkpoints

Persistent worktree: `$HOME/RiderProjects/light-house-recovery`, branch `recovery/sprint-5-poc`. Common Git store: the original `light-house/.git`. Exact recovered commit: **f85aeb810d74b4300a67463c999eeb7e2e0846ed**, feat: add tenant-authorised Jira incident context.

Checked that path/branch did not exist, then ran from the original repository:

```sh
git worktree add -b recovery/sprint-5-poc ../light-house-recovery f85aeb810d74b4300a67463c999eeb7e2e0846ed
```

Both original temporary worktree directories are unavailable. Their registrations, surviving indexes/reflogs and branch refs remain intact; no prune, GC, reset, rewrite, forced checkout or deletion. The implementation index matches f85aeb8 and no stashes remain. Git integrity checks found no missing-object errors. The later POC extension/proposal was not found in available Git objects or searched repository locations. It is reconstructed, not byte-for-byte recovered. Private historical recovery material was not imported or published.

| Checkpoint                 | Exact commit                             | Evidence                                                                                   |
| -------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------ |
| Remote/main                | cc82f5044288f9a35894b06c9d8b08efa228b13f | PR 1 merged; post-merge Validate45780524271 passed                                         |
| Published Sprint 1         | ddf0d9d40439d5b529d4ceb6dab6cbc28e7ef5a1 | Current remote branch and draft PR #2 head                                                 |
| Local Sprint 1             | e1d12ffdb57910ba7c5873294ea6f9aaeb04d044 | One ahead/zero behind published Sprint 1                                                   |
| Local Sprint 2             | 3236eb74ec29edf0c4c1c3024c413ddda023a31f | Monitoring implementation and hosted evidence checkpoint                                   |
| Local Sprint 3             | 87ebd25f3f6c9552b648f49bbf072d14acbef053 | Operational persistence/recovery checkpoint                                                |
| Local Sprint 4             | e751585bef1505b6b4499ffd51d95ac455673dea | Transition persistence/read-only discovery checkpoint                                      |
| Recovered Sprint 5         | f85aeb810d74b4300a67463c999eeb7e2e0846ed | 15 ahead/0 behind main;10 ahead/0 behind published Sprint 1                                |
| Verified recovery baseline | 49e0e622f9604853fa6e83b1a5ca4ca2e334453d | Fresh 512-test baseline evidence, documentation only                                       |
| Reconstructed tests        | a06a6dc7059b26835aabb55a8d130410345fdd52 | Fresh 519-test local milestone                                                             |
| Documentation handover     | Commit containing this report            | Exact final SHA/tree/status supplied in handover; identify durably with git rev-parse HEAD |

The final documentation checkpoint adds the third recovery commit: expected 18 ahead/0 behind main and 13 ahead/0 behind published Sprint 1, verified after commit. All earlier refs retain their exact tips. Local commits have not been pushed. This checkout mitigates temporary-directory loss; it is still a shared local Git store, not an independent backup. Reviewed remote preservation is the next priority after owner approval.

## Fresh validation and implementation

Node 22.23.4/npm 10.9.9. Root `npm ci` exits 0 (339 added/340 audited); isolated harness install exits 0 (6 added/7 audited/0 findings). Before edits, canonical `npm run validate` reproduces 512 tests/51 files and94.81/93.35/96.84/95.96 coverage. After reconstruction it passes 519 tests/51 files with 94.81% statements, 93.51% branches, 96.84% functions and 95.96% lines. ESLint, Prettier, strict TypeScript, unit/contract/adapted SQLite integration/security regressions, coverage, both frontends, backend and local manifest wiring pass. Harness 20 checks and webhook dry-run pass with no hosted requests. Installed official manifest validate() returns success:true/errors:[] after build. Final documentation gate evidence follows in audit.

Authenticated Forge CLI lint exits 1/MAJOR_VERSION_RULE, without approval/fix/bypass/deploy. It is a separate blocked platform gate. No full native Forge/TiDB, queue, Jira permissions or installed theme success is inferred from local checks. SQLite's experimental warning is retained. The only reconstruction error was a new test TS2554 call mismatch, corrected in the test without changing the existing port. No confirmed runtime defect; no runtime implementation/manifest/lock/schema/engine/coverage-threshold changes from f85aeb8.

| Supported local slice                                                  | Concrete evidence                                                                                                                                                         |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication, tenant/source attribution, resource/dependency mapping | Existing MonitoringService/Zabbix adapter, concrete inbox repository and inventory topology in POC fixture; wrong credential writes no downstream state                   |
| Customer/service impact and policy selection                           | One customer/two services, actual inventory enrichment and strictest-tier immutable SLA assertions                                                                        |
| Deduplication/durable linkage                                          | Concurrent replay leaves one inbox/evidence/incident/JSM intent and one injected create; actual SQL issue mapping/attempts persisted                                      |
| Recovery and uncertainty                                               | Recovery preserves snapshot/state; ambiguous marker reconciliation links once; zero-result exhaustion never recreates                                                     |
| Operational incident visibility                                        | New real v005 migration/configuration/authority/initialise and command replay, concrete list and safe context summary                                                     |
| Embedded context and access                                            | New real reverse lookup of the orchestrated SQL link; grant revocation/exact expiry/other-tenant-only membership, foreign installation/project and Jira denial before SQL |
| Retry/idempotency                                                      | Persisted 429 due-time persistence, no early POST, identical stored request/marker on eligible retry, same receipt/incident/SLA                                           |
| Safe projection/closure                                                | No installation/account/credential/request/audit fields returned; native confirmation null remains disabled                                                               |

Seven reconstructed cases extend the retained four POC tests to 11; the additions are larger than the reported lost 126 lines because they include operational setup and failure paths. Mocked creation/visibility prove local integration only. Root runtime pins: API 8.5.1,Bridge 7.4.0,Events 3.0.11,KVS 2.1.3,SQL 4.0.11,Resolver 2.0.2,React/ReactDOM 18.3.1.

Build fingerprints (local smoke artifacts, not official deployed package attestation):

| Artifact                     | SHA256                                                           |
| ---------------------------- | ---------------------------------------------------------------- |
| package-lock.json            | 93077a48eaf451291acd6f79c0c712212807cd5446bd1f4329a42386fc578679 |
| manifest.yml                 | f3be1d96442eec50d87919ac59c58b481d695d343fbd980b85d4247cc5944483 |
| Global JS index-59yShCzq.js  | 3368294779255e0182aeb5cd0690da8fbff88c200ad41fa98a0973b1ecac4f99 |
| Context JS index-Bn1iW0hB.js | 5f47b426ef913f1da618551ed96acec6df589dd48fa4405af69f0d4da098762c |
| Backend index.cjs            | 0c89ed34888427f65dd3d332e571225a397f9aa155f7c7aa49f395771ec35f5a |

## Recovery changed files

These paths cover the three recovery checkpoints relative to f85aeb8; existing implementation files are preserved unchanged:

- `AGENTS.md`
- `README.md`
- `docs/architecture/component-model.md`
- `docs/integrations/jira-embedded-context-contract.md`
- `docs/integrations/jsm-programme-contract.md`
- `docs/operations/autonomous-hosted-discovery.md`
- `docs/operations/sprint-5-hosted-poc-plan.md`
- `docs/operations/synthetic-jsm-project-proposal.md`
- `docs/project/acceptance-criteria.md`
- `docs/project/audit.md`
- `docs/project/autonomous-execution-state.md`
- `docs/project/changelog.md`
- `docs/project/dependency-security-assessment.md`
- `docs/project/programme-security-assessment.md`
- `docs/project/requirements.md`
- `docs/project/risk-register.md`
- `docs/project/sprint-5-recovery-report.md`
- `docs/project/tracking.md`
- `tests/integration/poc-orchestration.test.ts`

## Security and readiness review

Full/production standalone audits both exit 1: 12 affected packages(5 high/7 moderate), same three inherited ProseMirror/glob/minimatch advisory roots. Earlier 18-package cache-sensitive evidence remains conservative historical exposure, not fixed by today's lower count. LH-014 OPEN; no override/force fix/downgrade/dependency change. Existing isolated synthetic development acceptance does not cover production or automatically approve this new artifact. Licence, retention, R-01–R-14, actual tenant/installation isolation and native workflow enforcement remain open. No fresh full SAST or hosted security test; historical scanner coverage gaps retained.

Focused Forge readiness review (local tests/docs only; no newly confirmed source defect):

| Severity | Source       | Finding                                  | Location                                                                                                        | Description / required action                                                                                  | Official or project evidence                                               |
| -------- | ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Warning  | manifest     | Authenticated lint is gated              | manifest.yml:104, `<code>name: nodejs22.x</code>` plus actual CLI MAJOR_VERSION_RULE result                     | Exact manifest/platform version review and explicit rule disposition before deployment; do not bypass          | [lint](https://developer.atlassian.com/platform/forge/cli-reference/lint/) |
| Warning  | resolver     | Native module-key shape unaccepted       | src/forge/jsm-context/boundary.ts:34, `<code>['light-house-incident-context', 'issue-context-resolver']</code>` | Finite provisional runtime compatibility list; verify actual hosted shape and independent asUser/tenant denial | [context contract](../integrations/jira-embedded-context-contract.md)      |
| Warning  | dependencies | LH-014 still open                        | package.json:31, `<code>"@forge/bridge": "7.4.0"</code>`                                                        | Inherited audit failures, unchanged lock; fresh exact-artifact development disposition and release blocker     | [composition assessment](programme-security-assessment.md)                 |
| Info     | resolver     | Native closure intentionally unavailable | src/infrastructure/sql/operations-repository.ts:844, `<code>return null;</code>`                                | Preserve until accepted preflight/confirmation/bypass enforcement; do not claim full lifecycle readiness       | [ADR0021](../adr/ADR-0021-native-transition-intents.md)                    |

No ADS decision or UI implementation change was made. Forge builder/review local reference skills were read from the original ignored tooling location; nothing was vendored. Forge MCP documentation search with genuine app.id failed transport; exact official JSM/Forge pages verified 2026-11-28 are linked in the proposals. Tool availability is now different from older logs: Atlassian discover/executeRead works; bounded project search returned 0 visible projects. No unverified project existence conclusion or new authentication request.

## Publication and integration proposal — approval required

First preserve the exact reviewed recovery branch remotely using a normal single-ref push; no force/mirror/tags/all-ref publication. Intended command AFTER approval and final SHA recheck:

```sh
git push origin refs/heads/recovery/sprint-5-poc:refs/heads/recovery/sprint-5-poc
```

Then create one draft PR from recovery/sprint-5-poc to main covering the cumulative implementation. Link existing draft PR #2 as the older published Sprint 1 checkpoint; leave it unchanged until owner approves superseding/closing it. Recommended review order follows preserved commits: tenancy/inventory; intake; enrichment/SLA/JSM creation; operations/recovery/NOC; transition persistence with closure disabled; embedded context; recovery tests/docs. One cumulative PR avoids duplicate cherry-picks or reconstructing existing work. Do not merge overlapping PR 2 first without re-evaluating ancestry/CI and owner integration decision.

Read back protection today: strict validate required, admins enforced, conversations must resolve, forcepush/deletion disabled. Preserve merge-commit/cleaned ancestry strategy; no rebase/squash/history rewrite proposed. Branch-only push does not run the current CI workflow; a draft PR triggers credential-free Validate. Required exact-final-head workflow: npm ci, npm ci --prefix e2e, npm run validate and npm run test:e2e:check, with no Atlassian credentials/deploy. All conversations/checks/owner native or release conditions must be satisfied before separately authorised history-preserving merge. Verify actual post-merge main CI and local ancestry afterwards; never pre-claim success.

Privacy scope: introduced committed history through baseline 49e0e62 (16 commits/488 unique blobs) passed bounded private-site/cloud/workstation/personal-email/token/key patterns; author/committer metadata all noreply. Final tracked/untracked candidates and final introduced history receive another bounded scan and complete diff/path review before checkpoint. Do not push private recovery bundles/original refs/maps, .agents/.codex, auth sessions, target files, raw console/log/HAR evidence, node_modules, coverage/dist or scanner artifacts. A bounded scan is not an absolute absence guarantee or licence approval. Remote source publication is separate from Forge app distribution.

## Hosted acceptance proposal and owner decisions

Use the [reconstructed synthetic JSM proposal](../operations/synthetic-jsm-project-proposal.md) and [operation-by-operation hosted plan](../operations/sprint-5-hosted-poc-plan.md). Propose Lighthouse NOC — Development/LHNOC, ITSM/company-managed if available, Lantern Fibre, synthetic-only. Prefer an existing accessible project/request type and compatible fields. Project/desk/type/priority/custom-field IDs remain UNKNOWN. Current gateway requires four distinct custom fields plus summary/description/priority; minimal field changes may be needed. No provisioning has occurred.

Minimum next decisions are separable:

1. Approve exact reviewed recovery-branch push and draft PR for remote preservation only; no merge/deployment implied.
2. Have the authorised admin resolve existing-project visibility/access or approve the minimum synthetic project/field configuration with confirmed existing entitlement and no paid change.
3. After exact metadata/artifact/native prerequisites and fresh usage/pending reservations are known, approve the bounded DEVELOPMENT deployment/install/schema/source/event/notification scenario and its LH-014 disposition. No broad mutation approval or production security waiver is requested now.

Existing major 4/deployed source 2b97545, historical health/inventory results and 292 usage remain recorded; embedded context is undeployed, full hosted POC unaccepted and metering/pending/receipts/current schema state UNKNOWN. No Jira tickets, credentials, secrets, queues, migrations, deployment, installation, publication or merge were changed in recovery. Installed theme checks remain unverified; no browser launch retried. Licence awaits owner choice. Local recovery/reconstruction is complete after final gates; demonstration and release remain blocked by these external gates.

## Exact continuation

```sh
cd "$HOME/RiderProjects/light-house-recovery"
git status --short --branch
git log -3 --oneline
git rev-parse HEAD
git rev-list --left-right --count origin/main...HEAD
```

Read the final continuation entry and this report before any action. Resume this conversation with `codex resume` when execution is available; unattended automatic resumption and credit-limit forecasting are unsupported here. Next action is owner review of the preservation/project proposals, not repeated local implementation, a new sprint or a hosted mutation. Regenerate installation/build evidence only if the committed artifact changes.
