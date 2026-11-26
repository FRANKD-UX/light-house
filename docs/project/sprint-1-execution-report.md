# Sprint 1 execution report

Date: 2026-11-26. Branch: sprint-1/tenancy-network-inventory. Isolated worktree: light-house-sprint1 in temporary workspace storage. Baseline: verified origin/main cc82f5044288f9a35894b06c9d8b08efa228b13f. Local implementation commit: f04d41a36204f5fe8f094d787ad2ef27486d743a. This report does not mark Sprint 1 complete.

## Baseline and authorisation

Original main was clean, at the accepted merge, with only the original worktree. Fetch independently confirmed origin/main. GitHub confirms public FRANKD-UX/light-house, merged PR #1 and successful post-merge run 45780524271 at that SHA. Branch protection still requires validate, enforces administrators and prohibits force pushes; no open PR existed at inspection. Existing deploy history lists successful major-2 deployments at 07:11:02.488Z and 07:51:19.141Z on 2026-11-26. The prior accepted record establishes development version 2.1.0; history output itself reports only major 2. App identity/Developer Space were preserved; no registration or installed-state change occurred.

Baseline npm ci/validate passed: 35 tests, 97.95% statements, 98.36% branches and 100% functions/lines. The initial worktree command selected system npm and failed its engine check; explicitly selecting accepted Node 22.23.4/npm 10.9.9 resolved it. No engine check was weakened. Stale foundation blockers were reported and reconciled under the owner's explicit Sprint 1 request. No next sprint was inferred.

## Implementation inventory and acceptance status

| Requested area             | Implemented locally / evidence / remaining boundary                                                                                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LH-101                     | Forge SQL ports/adapters, fifteen-table schema, readiness/async migrations, trusted tenancy, optimistic writes, bounded durable repair and security negatives. Live/CI/review/merge gates remain open.                                                                                                                                                                                                                                                                          |
| LH-102                     | Persisted inventory/service/team/policy domain and use cases, deterministic synthetic topology and functional minimal UI. Actual installed persistence remains unverified.                                                                                                                                                                                                                                                                                                      |
| Owner decisions            | Retention/deletion policy; operational SLA clock/start/strictest-tier/unknown-impact/reopen semantics; project licence. Demonstration-only settings do not decide them. Deployment/SQL consent and changed dependency-risk disposition require explicit approval.                                                                                                                                                                                                               |
| Schema/migrations          | installation_metadata, isp_tenants, tenant_memberships; eleven inventory tables (sites/carriers/uplinks/customers/customer_services/service_dependencies/teams/assignees/team_memberships/sla_tiers/sla_policy_versions); minimal mutation_receipts. Fifteen immutable v001 named DDLs, pinned digest/order. No incident/event/Jira/Zoho/workflow/directory tables.                                                                                                             |
| Manifest/dependencies      | SQL mysql module, explicit async consumer with 900-second ceiling, read:jira-work for the exact administrator-check endpoint. Exact SQL 4.0.11/API 8.5.1/Events 3.0.11 added; lockfile committed. No egress/KVS/admin-write scopes or ORM. Identity/runtime preserved.                                                                                                                                                                                                          |
| Installation/ISP isolation | getAppContext installation/environment; resolver accountId; server membership/role/expiry; tenant-bound queries, joins, reverse references and pages. Local two-ISP and separate-database simulations; no genuine second-installation acceptance.                                                                                                                                                                                                                               |
| Bootstrap/authorisation    | Backend asUser GLOBAL ADMINISTER permission required for installation bootstrap/recovery; draft tenant activates after durable initial grant. Ordinary viewer/operator/admin roles separate reads, inventory writes and configuration/grants/repair. Payload identity/permission claims and directory/team mappings cannot grant access.                                                                                                                                        |
| Domain/repositories        | Strict unknown parsing, UTC/length/enum/integer validation, opaque UUIDs, case-sensitive natural keys, physical relation columns/indexes, controlled lifecycle and expected-version writes. Parent/reference checks run under durable ISP admission. No delete/cascade API.                                                                                                                                                                                                     |
| Inventory                  | Sites/carriers/primary-backup roles/capacity and same-site protection; synthetic customer alias/reference and independent service identities; required/failover dependency groups. Self/foreign/retired/duplicate relationships denied. No final customer-impact calculation.                                                                                                                                                                                                   |
| Teams/access               | NOC/Network Engineering/Core Response, manual assignee aliases and team memberships; independent tenant access grants with expected versions/revocation/expiry. No handoff workflow or external directory. Full membership administration/pagination beyond 50 remains later scope.                                                                                                                                                                                             |
| SLA                        | Editable CAS drafts, trusted publication actor, immutable published content, P1/P2/P3 positive durations/valid elapsed warning offsets, tier revision claims, duplicate/overlap/gap rejection. Contiguous finite intervals support new versions; an open-ended published version has no supersession operation yet. No execution/native SLA integration or real contractual values.                                                                                             |
| Fixtures                   | Two explicitly bootstrapped ISPs. Each: 3 sites, 2 carriers, 6 uplinks, 6 customers, 8 services, 8 dependencies, 3 teams, 2 unmapped assignees, 2 team memberships, 2 tiers, 2 draft policies =44 rows. Deterministic fixture keys/relationships; UUIDs generated once server-side. Explicit four-record batches, 11 per ISP, idempotent read-only reruns and repair continuation. Service 8 is unmapped; service 1 has primary/backup failover.                                |
| Mutation envelope          | One complete ISP intent ≤8192 characters, target pending intent ≤4096, aggregate CAS and unique command/version receipt. Injected pre-target/receipt/policy failures repair idempotently; conflicting commands block. Concurrent replay/original converges and an old completion cannot clear a newer ISP command. Explicit authorised development-only repair probe exercises a durable partial write later on Forge. No transaction/session/lock/distributed atomicity claim. |
| Custom UI                  | Explicit tenant/schema load, schema state, development migration/seed/probe actions, authorised selection, bounded lists/pages, editable configuration, publication, grant/revoke and repair controls. Loading/empty/validation/conflict/denial/error states; no polling. Existing manual health diagnostics remain.                                                                                                                                                            |
| Tests/coverage             | Unit domain/unknown-boundary/mock SDK/driver/jsdom regressions; SQL contract/digest/parameterisation/query budgets; in-memory SQLite integration with documented DDL/upsert adaptations. All existing gates preserved; newly implemented modules are included. Final results below.                                                                                                                                                                                             |
| Local validation           | Final npm ci/validate and focused integration/contract results recorded in audit. Earlier failures were corrected rather than suppressed; there are no added coverage exclusions. SQLite is experimental local Node tooling, never application persistence.                                                                                                                                                                                                                     |
| Official Forge lint        | Final explicit-development run completed: exit 1, 0 errors, 0 warnings, 1 MAJOR_VERSION_RULE approval for scope modification/major upgrade. No --approve override used. Earlier secure-store failure/two 300000ms timeouts are historical attempts. Baseline lint does not resolve the new approval gate.                                                                                                                                                                       |
| Security/dependencies      | Full/production audits fail on existing advisory roots with additional affected API/SQL/Events paths; no automatic extension of LH-014. OpenGrep/manual review, source/packaging graph and staged privacy review documented separately. No scanner artifacts or machine configuration published.                                                                                                                                                                                |
| FinOps                     | Indexed tenant operations, four-record seed batches, tested query budgets, keyset limits and bounded migration retries. No polling/schedules or billable resources created. Actual SQL compute/requests/storage and GB-seconds remain unmeasured.                                                                                                                                                                                                                               |
| Forge SQL runtime          | No Sprint 1 deployment/install/migration/seed/runtime result exists. Live runbook prepared. Actual native query-policy/collation/affectedRows/duplicate/error, retry/concurrency, persistence, two-tenant and repair acceptance are open; second genuine installation unavailable.                                                                                                                                                                                              |
| Files/commit/PR            | File inventory and implementation commit recorded below. Local commit only; prepared PR body and publication commands, no push/new PR/merge. Main/original source worktree preserved.                                                                                                                                                                                                                                                                                           |
| Owner follow-up            | Review code/restrictions and changed risks; authorise the reported major-upgrade approval; explicitly authorise development deployment/SQL upgrade and risk disposition; execute live acceptance; separately authorise publication/review/merge. Retention/licence/operational policy remain undecided.                                                                                                                                                                         |
| Sprint 2 readiness         | Interfaces/topology are prepared for later ingestion, but Sprint 1 is incomplete under its definition of done. Do not start Sprint 2 automatically.                                                                                                                                                                                                                                                                                                                             |

## Tooling and source verification

Read/applied builder, security-review, debugger, application-review and cost-optimiser skills. Reproduction remains `forge skills install --agent codex --scope project --dry-run`, then the documented install/status commands; tooling stays ignored in .agents/.codex and CI does not depend on it. No declared per-skill semantic version was available. Inspected SKILL.md SHA-256 values:

- builder: 3cac8fd0028e2c314d9255dc2e169d886502ee7852cd4592bfc8a7454810727b
- security-review: 34c666a37ea0a674e26d7b56e02ac27a2e45cf29fbe7a1a5515c8d836a9146ce
- debugger: b5b05d11d3a5ac7f9550e2ea6eb5b2aeb54d815b13a7a8996baed6250d68ad5d
- application-review: c830942585bf03201107c86e4a964bb40c649781e1814f53095064a069574f87
- cost-optimiser: 027e9ad0452072b94f31a04eb5487ec9190b307e02e78ba2817950812f375d06

The security skill was copied into the ignored worktree tooling directory to allow its pinned scanners to operate; no local MCP credentials/configuration or evaluation fixtures were proposed for Git. Forge MCP consulted before platform choices; ADS MCP verified input/border/text tokens. Exact official SQL/schema/DML/types/query-policy/context/permission/async/limits/pricing sources verified 2026-11-26 in ADR-0016, persistence, security and cost documentation. One transient MCP search failure and unavailable guessed legacy URLs were corrected using canonical official pages. No unavailable source is treated as verified. React review applied hooks/state/event/semantic-label/escaped-text and bundle-boundary checks; no Next.js or new component framework introduced.

## Publication and merge preparation

Commands are prepared, not executed. Repeat public-release/staged secret review first. Execute publication only under explicit owner authorisation:

```sh
git push --set-upstream origin sprint-1/tenancy-network-inventory
gh pr create --base main --head sprint-1/tenancy-network-inventory --draft --title "Implement Sprint 1 ISP tenancy and network inventory" --body-file docs/project/sprint-1-pr.md
gh pr checks --watch
```

Only after actual live acceptance, required CI, review and explicit merge authorisation (set LIGHT_HOUSE_MAIN_WORKTREE privately to the preserved original checkout):

```sh
gh pr ready
gh pr merge --merge
git -C "$LIGHT_HOUSE_MAIN_WORKTREE" pull --ff-only origin main
```

No force push, history rewrite, protection change, public recovery backup, automatic licence or real/customer infrastructure is involved. Actual merge/post-merge CI/main sync evidence must be recorded then; these commands are not evidence that it happened.

## Final local evidence

Final npm ci and npm run validate exited 0 on Node 22.23.4/npm 10.9.9. 83 tests/10 files passed. Coverage: statements 96.79% (695/718), branches 96.30% (599/622), functions 100% (164/164), lines 97.91% (658/672). Existing 90/85/90/90 gates are unchanged; no new exclusions. Focused integration/contract run: 21 tests/2 files, exit 0. Strict TypeScript/lint/format, UI/backend builds and local manifest checks passed. Full and production standalone audits each exit 1 with 11 affected packages (5 high/6 moderate). Final Forge lint exits 1 solely for MAJOR_VERSION_RULE approval, with zero errors/warnings. No --approve override, deployment, SQL migration or publication occurred. No live gate is inferred from tests/builds.

## Commit evidence and files

Implementation commit: f04d41a36204f5fe8f094d787ad2ef27486d743a, using the existing repository noreply email. Original main remains at cc82f504 and the isolated implementation tree was clean after this commit. A following documentation-only commit records this immutable commit/file inventory; final handover reports that evidence commit separately. No Sprint 1 remote push/PR/merge or deployment occurred.

| Change   | File                                                       |
| -------- | ---------------------------------------------------------- |
| Modified | AGENTS.md                                                  |
| Modified | README.md                                                  |
| Modified | docs/adr/ADR-0003-forge-native-persistence.md              |
| Modified | docs/adr/ADR-0004-installation-and-isp-tenant-isolation.md |
| Created  | docs/adr/ADR-0016-sprint-1-persistence-and-repair.md       |
| Modified | docs/adr/README.md                                         |
| Modified | docs/architecture/data-model.md                            |
| Modified | docs/architecture/persistence.md                           |
| Modified | docs/architecture/security.md                              |
| Modified | docs/architecture/sla-engine.md                            |
| Modified | docs/architecture/tenancy.md                               |
| Modified | docs/hackathon/demonstration-scenario.md                   |
| Modified | docs/operations/cost-governance.md                         |
| Modified | docs/operations/deployment.md                              |
| Created  | docs/operations/sprint-1-live-acceptance.md                |
| Modified | docs/project/acceptance-criteria.md                        |
| Modified | docs/project/audit.md                                      |
| Modified | docs/project/changelog.md                                  |
| Modified | docs/project/dependency-security-assessment.md             |
| Modified | docs/project/requirements.md                               |
| Modified | docs/project/risk-register.md                              |
| Created  | docs/project/sprint-1-execution-report.md                  |
| Created  | docs/project/sprint-1-pr.md                                |
| Created  | docs/project/sprint-1-security-review.md                   |
| Modified | docs/project/tracking.md                                   |
| Modified | docs/testing/regression-matrix.md                          |
| Modified | manifest.yml                                               |
| Modified | package-lock.json                                          |
| Modified | package.json                                               |
| Modified | scripts/check-manifest.mjs                                 |
| Created  | src/application/inventory/fixtures.ts                      |
| Created  | src/application/inventory/ports.ts                         |
| Created  | src/application/inventory/seed.ts                          |
| Created  | src/application/inventory/service.ts                       |
| Created  | src/domain/inventory/model.ts                              |
| Modified | src/domain/value-objects/application-metadata.ts           |
| Created  | src/forge/inventory/boundary.ts                            |
| Created  | src/forge/inventory/migration.ts                           |
| Modified | src/forge/resolvers/status.ts                              |
| Modified | src/index.ts                                               |
| Created  | src/infrastructure/sql/access-repository.ts                |
| Created  | src/infrastructure/sql/driver.ts                           |
| Created  | src/infrastructure/sql/inventory-repository.ts             |
| Created  | src/infrastructure/sql/migrations.ts                       |
| Created  | src/infrastructure/sql/migrations.v001.json                |
| Modified | static/app/src/App.tsx                                     |
| Created  | static/app/src/Inventory.tsx                               |
| Created  | static/app/src/inventory-contract.ts                       |
| Modified | static/app/src/styles.css                                  |
| Created  | tests/contract/inventory-sql.test.ts                       |
| Created  | tests/integration/inventory-service.test.ts                |
| Created  | tests/support/sqlite.ts                                    |
| Modified | tests/unit/app.test.tsx                                    |
| Created  | tests/unit/inventory-boundary.test.ts                      |
| Created  | tests/unit/inventory-domain.test.ts                        |
| Created  | tests/unit/inventory-driver.test.ts                        |
| Created  | tests/unit/inventory-ui.test.tsx                           |
| Modified | tests/unit/resolver.test.ts                                |
| Modified | tests/unit/theme.test.tsx                                  |
| Modified | vitest.config.ts                                           |

## Independent pre-deployment review — 2026-11-26

The subsequent [owner decision package](sprint-1-readiness-review.md) reproduces the baseline and records the exact dependency delta, scope/SQL major-consent distinction, database safety, local resource counts and publication review. It supersedes any assumption that three extra affected package names are three new advisories or that LH-014 foundation acceptance automatically extends. The sixteen live checks and genuine two-installation procedure remain unexecuted. No source/dependency/permission change was justified by this review; updated documentation is uncommitted. No new deployment/install/native migration/publication or sprint occurred.

## Current authorised execution checkpoint — 2026-11-26

Owner now authorises reviewed development deployment/installation SQL upgrade, exact-tree LH-014 exception, fifteen migrations and synthetic acceptance with a 5,000-request planning budget, public Sprint 1 branch/PR and remote CI. Earlier no-authorisation statements are historical. Second genuine installation and final merge still need separate owner approval. Reproduced npm ci/validate: 83 passing tests, unchanged coverage (96.79/96.30/100/97.91). Full/production audits each retain five high/six moderate findings; LH-014 remains open. Approved-rule Forge lint passes, CLI 16.0.0. No source/manifest/lockfile change. Browser unavailable; fresh usage readings requested. Live results will be recorded separately from authorisation and local checks.

## Development platform result — 2026-11-26

Deployment succeeded at 10:39:39.963Z, actual version **3.0.0**, one MAJOR_VERSION_RULE approval, original application identity preserved. Existing authorised Jira development installation upgrade succeeded; independent listing confirms one installation, major **3 (Latest)**, appVersion 3, Up-to-date. Only read:jira-work listed; no extra consent rule or permission. Official inspected backend: 255886 bytes, 131 mapped sources; affected glob/minimatch/ProseMirror leaves and excluded tooling absent from map. Twelve package/resource files reviewed for sensitive artifacts; only generic SDK installation-ARI templates matched. Exact hashes/commands in audit. Dependencies remain affected under the exact-tree development exception.

Owner supplied pre-SQL baseline at 10:40:37Z: USD 0.00 current/forecast, SQL 0 requests/compute/storage, functions 2.548 GB-seconds; reporting period 1–26 November. This followed deployment start and is not a pre-deployment measurement. Browser unavailable; owner UI migration/health action requested. Native migration/schema/seed/isolation/concurrency/recovery gates remain unexecuted at this checkpoint; no live pass inferred.
