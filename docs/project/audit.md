# Engineering audit — 2026-11-24

## Repository baseline

Working directory: the local `light-house` checkout. Initial repository had no tracked files, commits, remotes or existing package configuration; main was unborn and status was clean. Reserved read-only `.agents`, `.codex` and `.aws` surfaces were preserved and excluded from source control. No existing repository AGENTS.md applied.

Created minimal README baseline commit `ff2939c` on main, then `sprint-0/engineering-foundation`. The sandbox mounts `.git` read-only; authorised local Git mutation succeeded through the reviewed escalation. No reset, remote push or deployment occurred.

Initial tools: Node 22.22.1, npm 9.2.0, GitHub CLI 2.92.0; Forge CLI absent. Isolated `/tmp/light-house-forge-tools` now contains Node 22.23.4 and Forge CLI 16.0.0. The original Node installation was not changed. Forge configuration/data were redirected with XDG_CONFIG_HOME/XDG_DATA_HOME under /tmp; usage analytics disabled in this isolated unauthenticated configuration.

## Actual failures and remediation

- Initial repository search returned no files; subsequent independent checks confirmed the empty baseline.
- Default npm cache was read-only (EROFS); all subsequent npm operations use `/tmp/light-house-npm-cache`.
- An initial generator command used unavailable `python`; rerun successfully with `python3`. These are temporary local file-generation helpers, not application/backend dependencies.
- Dependency installation hit EBADENGINE for current jsdom under the host Node; isolated supported Node resolves the engine requirement. React 19 produced transitive React-18 peer conflicts; selected React 18.3.1.
- Registry fetches timed out; partial generated node_modules was discarded before retry. No source files were removed.
- Forge initially could not write home configuration/data; isolated XDG locations allow CLI operation.
- Forge CLI 16.0.0 `lint --non-interactive` exited 1: `Invalid app details in the manifest.yml file. Register your app by running forge register.` This is an actual blocked Forge validation, not a passing schema check. No fake ARI was inserted.

## Validation evidence

Clean `npm ci --prefer-offline --maxsockets=3 --fetch-timeout=300000 --no-audit --no-fund` passed using the committed lockfile (332 installed packages). Lint passed; strict typecheck initially failed TS2882 for the CSS side-effect import, corrected with Vite client type declarations and rerun successfully. Coverage run: **3 test files passed, 10 tests passed, 0 failed**. Configured implemented scope: 100% statements (24/24), branches (8/8), functions (13/13), lines (22/22); 7 runtime files covered, 5 type-only/empty files skipped.

UI build passed with Vite 8.3.8: index HTML 0.39 kB, CSS 0.43 kB, iframe-resizer chunk 29.18 kB, main chunk 205.25 kB (64.80 kB gzip). Backend esbuild smoke bundle passed at approximately 3.0 kB with Forge Resolver externalised. Local manifest resource/function wiring passed. An additional check against the installed official `@forge/manifest` 13.9.1 JSON schema reported exactly one error: required `/app/id` missing. No other schema errors were reported; this is not authenticated CLI acceptance.

Final aggregate `npm run validate` **passed (exit 0)** after a clean lockfile install: lint, format:check, typecheck, 10-test coverage suite, both builds and local manifest wiring. Subsequent edits only record this evidence; final formatting and Git checks were repeated. No authenticated Forge deployment, installed UI, live integration, database, JSM request or email-delivery test has been executed. Mocked SDK/Bridge tests remain unit tests.

## Security and dependency review

Initial production dependency audit reported 8 affected packages (5 high, 3 moderate), transitively through current Forge Bridge: ProseMirror paste handling XSS, glob cancellation/DoS and minimatch amplification. Audit suggested a major Forge Bridge downgrade, not a verified safe compatible fix. No force fix or silent SDK downgrade was applied. Final full and production audits both report **8 affected packages: 5 high, 3 moderate, 0 critical**. Package chain: @forge/bridge, @atlaskit/adf-schema, @atlaskit/adf-schema-generator, @atlaskit/editor-prosemirror, prosemirror-view, @forge/manifest, glob and minimatch. Three underlying advisory records are [ProseMirror paste XSS](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w), [glob cancellation](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4) and [minimatch amplification](https://github.com/advisories/GHSA-g3hv-75wg-m249), obtained from npm audit on 2026-11-24. npm audit exits 1, intentionally recorded as an unresolved security finding; it is not silently counted as a clean security gate. Track LH-014 before deployment/release. The app does not import an editor or invoke filesystem globbing, but reachability of every upstream path is not proven. No editor/paste feature exists in the shell, but absence of a feature does not erase the installed-tree findings. Release acceptance must revisit/remediate or explicitly assess any remaining advisories.

Credentials were not read, requested in chat, registered or written to source. The status resolver requests no Forge scopes or external egress. Secret-safe logs are allowlisted, configuration is ignored, and only synthetic design data exists. Full production penetration testing is not claimed.

## Owner/runtime gates

LH-013 requires owner authentication, real registration/ARI and development-site access plus deployment authorisation. Proposed ADRs, 24/7 SLA clock/start rules, replay/rotation/retention and cost budgets require owner review. Entra/Google/Zoho provider API/consent details are explicitly unverified. Remote CI execution needs a configured remote and separately authorised push. See operations/deployment.md for exact owner commands.

## Commands and review scope

Executed repository/tool checks: pwd, file inventory, git status/branch/remote/log/symbolic-ref, node/npm versions, command -v, gh --version. Inspected relevant existing agent instructions (none in this repository). Official web documentation was opened for the dated capability matrix and CI action references.

Executed local setup/checks: npm view for package versions/engines; isolated npm install of Node/Forge CLI; exact application/dev dependency installation; npm install --package-lock-only; npm ci; npm run format; npm run lint; npm run typecheck; npm run test:coverage; npm run build; npm run check:manifest; full and production npm audit; official JSON schema check; git diff --check and ignore checks. Aggregate validate is the final local gate. Read-only git ls-remote resolved the official action tags for SHA pinning. No remote mutation occurred.

Tool commands use `PATH=/tmp/light-house-forge-tools/node_modules/.bin:$PATH` for Node 22.23.4. Forge commands additionally use `XDG_CONFIG_HOME=/tmp/light-house-forge-config XDG_DATA_HOME=/tmp/light-house-forge-data`. Ran Forge --version, lint --help, settings set usage-analytics false and lint --non-interactive. The lint attempt failed solely at the initial app-registration gate; registration/login/deploy/install were not executed.

React review applied the available React best-practices skill: top-level hooks, immutable public metadata, effect cleanup, no dangerous HTML, semantic main/headings/status, CSS design tokens and small component scope. No unnecessary memoisation/cache or alternate frontend framework was introduced. Accessibility/browser/theme acceptance inside Jira remains open.

Final source review covered 90 candidate files: no matches for common credential/private-key patterns, no broken local Markdown links and `git diff --check` passed. Ignore checks confirmed .env variants, private-key extensions, reserved credential surfaces and generated outputs are excluded. This bounded heuristic review is not a full secret-scanning service or penetration test.

The first staged diff check caught Markdown hard-break trailing spaces in the ADR date lines; these were replaced with blank-line paragraph breaks before commit. This was a formatting failure, not a test failure. The staged check was rerun after correction.

# Sprint 0.5 stabilisation audit — 2026-11-25

## Independent baseline and preservation

`git status --short` was empty on entry. `git log -5 --oneline`, `git branch -avv`, `git remote -v` and `git ls-files | wc -l` independently confirmed main `ff2939c`, current `sprint-0/engineering-foundation` at `315200a`, 90 tracked files and no remote. No uncommitted owner changes existed. `manifest.yml` has no app.id; no legitimate ID was replaced or registration attempted. Console ownership cannot be authenticated without owner follow-up. Read AGENTS.md, README, manifest/packages/lockfile, all 14 ADRs, tracking/audit/changelog, architecture and affected integrations, test configuration/scripts and CI before changes. Previously reported ten-test/coverage/build results were treated as historical and rerun below.

Host Node is 22.22.1 (below project minimum), npm 9.2.0; Forge absent from host PATH. Existing isolated `/tmp/light-house-forge-tools/node_modules/.bin` supplies Node **22.23.4** and Forge CLI **16.0.0**. No global tool installation was changed. Use that PATH for current checks. Forge uses the existing isolated XDG_CONFIG_HOME `/tmp/light-house-forge-config` and XDG_DATA_HOME `/tmp/light-house-forge-data`; no credentials were read or requested. Initial audits/view under default read-only npm cache failed EROFS; rerun successfully using `/tmp/light-house-npm`. These initial errors are not security audit results.

## Architecture discrepancies and corrections

Baseline operational diagram allowed recovery→resolution on policy permission; early-recovery guidance also led to resolution without final validation. Unknown resources were quarantine/replay-only. Ownership, handoffs, three separate gates, embedded issue context and native Jira/app attribute authority were incomplete or absent. These discrepancies were reported before treating the architecture as aligned. ADR-0015 adopts only the owner's conceptual reference. Gap analysis classifies each requirement; existing architecture/model/ERD/security/SLA/JSM/docs/backlog were updated. Fixed workflow/checklists and minimal SQL representation are proposed defaults, not implemented functionality. No proprietary source/schema/branding or employer infrastructure was consulted.

Native Jira closure prevention remains a real-site gate: backend guards alone do not stop native UI/REST/automation. Site workflow restriction and bypass tests must be proven before claiming guarded closure. Owner decisions remain recorded for exact checklist/assignment policy, SQL defaults, 24/7/start/reopen/retention/replay/rotation and budgets. All original integrations and the 22 December 2026 22:00 SAST deadline remain. Extra timers/customisation/Zoho are outside the mandatory critical path. No Sprint 1 code/schema has been started.

## Actual commands and outcomes

Commands below run at repository root with `PATH=/tmp/light-house-forge-tools/node_modules/.bin:$PATH`; npm commands use `--cache /tmp/light-house-npm`. Forge commands additionally use the isolated XDG paths above. Exit codes are process results, not inferred acceptance.

| Command / check                                     | Exit  | Actual result / limitation                                                                                    |
| --------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------- |
| node -v / forge --version                           | 0 / 0 | 22.23.4 / 16.0.0 from isolated tools                                                                          |
| npm ci                                              | 0     | Clean lockfile install, 332 packages; reports existing 8 vulnerabilities                                      |
| npm audit --json                                    | 1     | 8 affected names: 5 high/3 moderate/0 critical                                                                |
| npm audit --omit=dev --json                         | 1     | Same eight findings; production classification does not prove bundling                                        |
| forge lint --non-interactive                        | 1     | Invalid app details; register app. Stops before authenticated validation                                      |
| Official @forge/manifest 13.9.1 JSON schema via Ajv | 1     | Exactly one validation error: required /app/id missing; not a passing official CLI gate                       |
| Temporary Vite emitted-module inspection            | 0     | Production UI build; vulnerable leaves absent from emitted module list                                        |
| esbuild backend smoke graph, resolver external      | 0     | 3,055 bytes; no Bridge or affected leaves                                                                     |
| esbuild backend graph including resolver            | 0     | 5,382 bytes; resolver has no runtime imports; only node:crypto external                                       |
| forge deploy --help / install --help                | 0 / 0 | Command flags reviewed; no deployment/install action performed                                                |
| gh auth status                                      | 0     | GitHub CLI authenticated to github.com account FRANKD-UX via keyring; masked token not copied into repository |
| git ls-remote official actions v7 tags              | 0 / 0 | Both pinned action SHAs match current official tags                                                           |

`npm run validate` exited 0; final result and staged/commit review are recorded below. Full/prod audit JSON and bundle graphs reside under `/tmp/light-house-*` for this session; durable advisory package/version/range/path/mitigation evidence is in dependency-security-assessment.md. Earlier failed cache operations were retried, not counted as passing audits. No `npm audit fix`, overrides, dependency updates or lockfile mutations occurred.

## Security, packaging and CI conclusions

Three official maintainer advisories were reopened and registry latest/dependency/patched-version metadata inspected. Eight names inherit three advisories. Bridge latest 7.4.0 and Manifest latest 13.9.1 still pin affected chains; editor 8.x/9 pin view 1.41.5. Patched view 1.42.3, glob 14.0.2 and minimatch 11.0.1 fall outside upstream pins/ranges. No safe supported compatible fix found; no major override or old Bridge downgrade applied. Every affected name is individually assessed in dependency-security-assessment.md. **LH-014 remains a deployment/release gate pending upstream fix or explicit owner residual-risk disposition.**

Local emitted UI includes Bridge but zero modules from affected ADF/editor/view/manifest/glob/minimatch leaves; backend graphs exclude that chain. This bounds current runtime reachability without claiming npm findings harmless. Actual Forge deployment packaging is not verified. Manifest still declares one global page, resource dist/ui, resolver index.handler, no scopes/egress and nodejs22.x; source/resource wiring is checked locally. No new module, data store or scope is added. Zero implementation changes means no new behaviour tests were fabricated; future security/transition cases were added to planned regression documentation.

CI unchanged after local review: PRs and main pushes, deterministic npm ci, Node from .nvmrc, read-only contents permission, no persisted checkout credentials, exact official action SHAs, no secrets or automatic deploy. No remote exists and no GitHub Actions run was triggered. Authenticated gh is not remote-creation/push authorisation. Exact private remote/setup and development-only acceptance commands/checklist are in operations/development-setup.md and deployment.md. No registration, deployment, install, remote creation, push, paid resource or live integration was performed.

## Final local validation and handover review

`npm run format` exited 0; `npm run validate` exited **0** on 2026-11-25: lint/format/strict typecheck, **3 test files / 10 tests passed / 0 failed**, 100% configured statements (24/24), branches (8/8), functions (13/13), lines (22/22); seven runtime files covered and five empty/type-only files skipped. UI/backend builds and local manifest wiring passed. These reproduce the prior local results without claiming future architecture behaviour or Forge runtime success. UI output main 205.25 kB / gzip 64.80 kB, iframe-resizer 29.18 kB / gzip 10.27 kB; CSS 0.43 kB and HTML 0.39 kB. Backend smoke output approximately 3.0 kB.

`git diff --check` and a repository-local Markdown destination check both exited 0 (no broken local links). Package/lockfile/manifest/CI and application source have no diff. Changes are documentation only: four created documents and existing architecture/project/operations/integration/test-plan refinements. Staged review inspected all 33 files: README and docs only, zero unexpected implementation/configuration files, zero private-key/GitHub/AWS/Slack/Atlassian token-pattern matches; `git diff --cached --check` exited 0. This pattern scan is not a full secret-scanner guarantee. Final commit hash and clean-tree verification are reported in the handover after commit. All secrets/config/reserved directories remain excluded. No credentials or real infrastructure/customer payloads were added.

Local commit on the existing branch is authorised by the Sprint 0.5 request. The commit containing this audit/report is identified with `git log -1 --format='%h %s'`; its hash cannot be embedded in its own content. No remote mutation, production/development deployment or next-sprint work is authorised by local completion. External gates remain unchecked in acceptance-criteria.md.

## Exact Sprint 0.5 changed-file manifest

- `README.md`
- `docs/adr/ADR-0003-forge-native-persistence.md`
- `docs/adr/ADR-0009-sla-ownership-and-native-jsm-interoperability.md`
- `docs/adr/ADR-0013-forge-ui-architecture.md`
- `docs/adr/ADR-0015-operational-workflow-mental-model.md`
- `docs/adr/README.md`
- `docs/architecture/component-model.md`
- `docs/architecture/data-model.md`
- `docs/architecture/event-lifecycle.md`
- `docs/architecture/persistence.md`
- `docs/architecture/security.md`
- `docs/architecture/sla-engine.md`
- `docs/architecture/tenancy.md`
- `docs/hackathon/demonstration-scenario.md`
- `docs/integrations/jira-service-management.md`
- `docs/integrations/zabbix.md`
- `docs/operations/deployment.md`
- `docs/operations/development-setup.md`
- `docs/project/acceptance-criteria.md`
- `docs/project/architecture-gap-analysis.md`
- `docs/project/architecture.md`
- `docs/project/audit.md`
- `docs/project/changelog.md`
- `docs/project/dependency-security-assessment.md`
- `docs/project/execution-report.md`
- `docs/project/forge-capability-assessment.md`
- `docs/project/requirements.md`
- `docs/project/risk-register.md`
- `docs/project/roadmap.md`
- `docs/project/sprint-0.5-execution-report.md`
- `docs/project/tracking.md`
- `docs/testing/regression-matrix.md`
- `docs/testing/strategy.md`

# Sprint 0.6 — 2026-11-26

## Baseline and authorisation

Inspected existing branch sprint-0/engineering-foundation at fee2896, previous 315200a/ff2939c, 94 tracked files, no remotes; only owner manifest.yml app.id addition modified. Preserved genuine owner-registered ARI unchanged. .agents/.codex ignored by existing Git policy, zero tracked files. Read AGENTS, tracking/audit, current dependency/operations docs and relevant ADR-0001/2/3/13/14 before edits. Discrepancy: current-facing text still claimed absent registration; corrected without repeating prior architecture. Owner explicitly authorised local commit, forbids deployment/install/site/payment/remote changes and Sprint 1. No such operation performed. Owner confirms suitable JSM development site exists, exact target to be identified before deployment.

## Environment and official tools

Node v22.23.4, npm 10.9.9, Forge CLI 16.0.0, gh 2.92.0 executable checks exit 0. Owner reports NVM 0.41.0, successful login/application registration/three environments and clean 332-package install. No unnecessary credentials read. gh auth status exit 0; token remained masked. Forge whoami, environments list, install list and lint --non-interactive each exit 1: CLI could not securely store login credentials in local credentials file. This execution environment cannot access the owner credential store; owner's authenticated terminal is not disproven. No token workaround extracted/configured; app ID presence and owner evidence do not equal independent platform verification.

forge skills status --non-interactive exit 0, project Codex skills/MCP; exact seven names and SHA-256 hashes in execution report. Relevant builder/review/debugger/security/cost instructions and references read/applied. Onboarding/connector assessed but workflows not applicable (Rovo/Teamwork Graph excluded). No per-skill semantic version available; no fabricated version or reinstall. Project MCP config reviewed: only two official HTTPS URLs, no credentials/unsafe commands/permission overrides. Forge MCP manifest/search tools and ADS MCP rule documentation responded; official pricing/billing/usage-alert/environment/KVS/SQL/packaging/CLI/site pages verified 2026-11-26 and cited in operations/assessment. One guessed old site/storage doc URL was unavailable; canonical current pages found and used, unavailable URLs not relied upon.

## Boundary fix and security evidence

ESLint 10.15.0 supported globalIgnores added for .agents/**, .codex/** and generated scan outputs; Prettier explicit tooling/artifact ignores; Git scan-artifact ignore. Source/frontend/tests/scripts/config rules untouched, no fixture edits, no dependency or lockfile change. ESLint API checks ignored tooling and includes app/config; actual lint set 21 files. TypeScript positive include, Vitest/coverage and Vite/esbuild/manifest paths already scoped, retained. No new behaviour tests for configuration-only repair. Independent secret review is not governed by these lint ignores.

Fresh full/prod audit with /tmp writable npm cache exit 1 each: 8 affected packages, 5 high/3 moderate. Default-cache attempts exit 1 with registry cache write errors and incomplete inherited metadata (14 names); retried cleanly, not counted as remediation. Registry view commands with cache exit 0: latest Bridge 7.4.0/Manifest 13.9.1/editor 9.0.0 retain affected pins. Official advisories reopened. No force fix/override/downgrade. Local build graphs (exit 0) enumerate UI 152 inputs, backend 6/7 external/full resolver, no affected leaves or agent tools. This does not prove absence from official Forge archive or build-time tool paths. LH-014 remains open; proposed owner development-only risk exception with 2026-12-03 expiry is unaccepted; production still blocked.

Mandatory security launcher executed first from installed skill directory exit 1 due read-only local tooling/cache. Unchanged skill copied to /tmp, retries exposed read-only cache/log locations; final launcher with XDG_CACHE_HOME=/tmp/light-house-security-cache, SEMGREP_SETTINGS_FILE=/tmp/light-house-security-settings.yml and SEMGREP_LOG_FILE=/tmp/light-house-opengrep.log exits 0. Pinned checksums verified. FSRT v0.1.1 completed 0 findings; scanned array imprecise, debug invocation with explicit /tmp permissions cache exit 0 confirms backend traversal. OpenGrep 1.16.2 completed 44 rules/19 files, 0 findings/0 errors, six standard-ignore files skipped, includes App/main/backend and no third-party fixtures. Snyk/gitleaks unavailable/not run. Manual review finds no confirmed exploitable app source-to-sink path in this public-metadata-only scaffold; no runtime assurance or fabricated CVSS/PoC. Detailed coverage gaps/index routing and risk recommendation in assessment; raw outputs/SARIF/graphs and security report stay ignored in security-audit-artifacts/.

## Independent quality gates

Commands run independently, all exit 0: npm run lint; npm run format:check; npm run typecheck; npm run test; npm run test:coverage; npm run build; npm run check:manifest. Test baseline preserved: 3 files, 10 passing/0 failed; statements 24/24, branches 8/8, functions 13/13, lines 22/22 (100% configured scope), 7 fully covered files/5 empty skipped. SDK/Bridge mocks labelled, no runtime/tenant tests claimed. UI main 205.25 kB/gzip 64.80, iframe-resizer 29.18/gzip 10.27, CSS 0.43, HTML 0.39; backend smoke approximately 3.0 kB. Local manifest check passes built resources/wiring/runtime/empty scopes; no official schema pass.

forge build/deploy --help exit 0; both inspect capabilities perform upload/deployment; no supported purely local artifact command established. No build upload or deploy attempted. Read installed CLI runtime-bundler source to verify entrypoint bundle/metadata/extraFiles policy; no broad extras configured. Official lint exit 1 credential-store blocker separately recorded. GitHub workflow still needs no local skills/private Atlassian credentials; action SHA tags reverified with git ls-remote, exit 0 both. No workflow change/remote CI execution.

Cost review low current optimisation opportunity; retained real backend status smoke invocation. Dated allowances, consolidated space billing, automatic alerts without assumed hard caps, conservative workload and owner console actions documented. Environment promotion/migration/secret policy and authorised first-development acceptance procedure updated. No billing settings, schema, schedules or runtime feature changed. Exact remote creation/push/PR/merge and deployment commands are follow-up procedures, not executed actions.

Final formatting, aggregate validation and staged/commit review follow below. The execution-report commit can be identified with git log -1; a self-referential commit hash cannot be embedded in its own report.

## Final Sprint 0.6 validation and handover review

npm run format exit 0; independent final npm run format:check exit 0; npm run validate exit 0 after documentation edits, repeating the same ten passing tests/100% implemented-scope coverage and build/local manifest results. git diff --check exit 0. Final evidence/report adds no dependency or source behaviour change. A final documentation-only acceptance ledger/tracking clarification was formatted and checked before staging. Local/staged destination and secret-pattern checks inspect every proposed file; no ignored tooling, fixtures, cache/binaries, .env or credential files are permitted in the index. This bounded pattern review does not claim enterprise secret-scanner coverage.

Staged review: exactly 16 intended files; zero .agents/.codex/fixtures/generated scan artifacts/dependencies/build outputs or credential files. Full staged-content scan found zero private-key/GitHub/AWS/Slack/Atlassian token, credential-assignment or URL-userinfo pattern matches. git diff --cached --check exit 0; local Markdown destinations pass; final npm run format:check exit 0. App source/tests/package-lock/package.json/CI remain unchanged. Report/source citations reviewed; only documentation clarifications followed the passing aggregate run. Local commit uses the requested existing branch and descriptive message; no push. Post-commit hash and clean-tree verification are returned in final handover; external gates remain pending.

## Final foundation acceptance update — 2026-11-26

The project owner explicitly authorises development deployment/install on the confirmed owner-controlled Jira site, public GitHub source publication after review, push/PR/CI and conditional history-preserving merge. No staging/production deployment, app distribution, paid provisioning, licence selection or Sprint 1 start is authorised. LH-014 is accepted with documented residual risk for isolated synthetic development only; it remains open, not remediated. See dependency-security-assessment.md and foundation-acceptance-report.md for current evidence and remaining gates. Earlier permission and registration blockers are historical.

## Final foundation Gates B/C execution evidence — 2026-11-26

This is final acceptance on the existing branch, not another sprint. Entry tree clean at 1841ec5; history ff2939c/315200a/fee2896/1841ec5 preserved. No remotes. Owner authorises development deploy/install and initially public GitHub/CI/conditional merge; subsequent explicit privacy hold blocks publication and history rewriting. No remote mutation was performed. The genuine app ARI is unchanged.

Commands/results: pwd/Git status/history/remotes and node/npm/Forge/gh versions inspected; Node 22.23.4/npm 10.9.9/Forge 16.0.0/gh 2.92.0. gh auth status exits 0, intended owner/SSH confirmed without extracting tokens. forge skills status/help exits 0; seven existing skill hashes match prior report. MCP config contains only official HTTPS Forge/ADS URLs; Forge MCP deployment/install/TypeScript searches responded. Builder, review, security and debugger instructions read. ADS changes were not needed. Relevant ADRs and current project evidence read before changes.

npm ci exit 0: 332 packages; install-time audit summary 14 (11 high/3 moderate). Separate npm audit --json --cache /tmp/light-house-acceptance-npm-cache and npm audit --omit=dev --json --cache /tmp/light-house-acceptance-npm-cache each exit 1: eight affected packages, five high/three moderate, matching recorded advisories. Package/lockfile/dependency versions unchanged. This differing install-time summary is recorded, not represented as remediation or silently substituted. LH-014 owner acceptance is isolated synthetic development only, with no production credentials/customer/real ISP data, monitoring and material-change/pre-promotion reassessment. Risk remains open; production security blocked. No force fix/downgrade/override.

npm run validate passed at entry and after the actual packaging fix: ESLint/Prettier/strict TS, ten tests/three files, 100% configured implemented-code coverage (24/24 statements, 8/8 branches, 13/13 functions, 22/22 lines), UI/backend build and local manifest wiring. Seven covered/five empty source files; no installed-runtime claims from mocks. UI main 205.25 kB, iframe-resizer 29.18, CSS 0.43, HTML 0.39; backend smoke 3.0 kB. Existing ignores/positive compile/test/build/resource boundaries inspected; no application rules weakened or third-party fixtures changed. No behavioural test invented for emit configuration; actual official deployment verified it.

Sandbox forge whoami exits 1 (credential store). Supported elevated retry exits 0. Elevated environments/list history/install-list/lint each exit 0: three environments, no previous deployments, no development installations, official lint no issues. Environment timestamp fields were not treated as successful deployments. No credentials were extracted or OS restriction bypass used.

First forge deploy --environment development --inspect --non-interactive: lint passes but bundling fails because root noEmit blocks ts-loader. CLI subsequently reports a telemetry network error yet exits 0; recorded as FAILED, not a successful deployment. Installed CLI ts-loader configuration confirms inherited root compiler options. Replaced root noEmit with outDir dist/typescript; local script remains tsc --noEmit, strictness retained. After validation passes, retry same development command exits 0 and explicitly deploys Light House 2.0.0. Actual deploy history: 2026-11-26T07:11:02.488Z, major 2, Success; history labels environment default, while explicit command/installation verify development. No staging/production command executed.

Official .forge/inspect backend artifact contains eight reviewed files. index.cjs 7,164 bytes, SHA-256 d41f96589f59a80e574b848c248d57ccc3e2496c73ae0d6b091c94e681b6fa0c; 13 source-map sources, no vulnerable leaf module/agent fixture references; bounded secret patterns no matches. Copied lockfile retains affected tree. Wrapper/platform/build-time/all-server-artifact coverage is limited; this is not vulnerability remediation. Existing frontend resources reviewed separately. No extra deploy/build upload solely for inspection.

Installation on the exact privately recorded authorised Jira site, development, exits 0; independent installation listing exits 0, major 2/up-to-date. CLI warning classifies the site as production; the Forge app remains development. No site provisioning or paid resource/billing change. Browser inventory fails: host unavailable. Owner confirms Apps navigation and supplies actual rendered shell with product/stage/unconnected integrations/backend-available text. Actual forge logs --environment development --limit 30 exits 0 and returns two backend.status/success entries at 07:14:47.606Z and 07:15:23.402Z with UUID correlations, no payloads and no errors in that queried window. Exact typed response/frontend Console/Network/theme acceptance remains pending owner verification; no fake metrics appear in supplied text. Post-test usage console inaccessible; dated owner zero baseline recorded in cost-governance, not claimed as post-test observation.

Mandatory deterministic launcher first exits 1 with read-only tool/cache paths; unchanged /tmp tooling copy and writable cache/settings/log retry exits 0. FSRT v0.1.1 zero findings (imprecise scanned array), OpenGrep 1.16.2 44 rules/19 files zero findings/errors, six standard-ignore files. Global/auditing/misc scope and prior minimal read-only source-to-sink review retained; absent future auth/tenant/query/secret/egress/webtrigger/Rovo surfaces not given fabricated tests. Raw scans stay ignored. Gitleaks/Snyk unavailable. Installed licence inventory: 332 records; direct Forge SDK licences reference Atlassian terms, React MIT notices retained in installed packages; no vendor/build publication proposed. Third-party redistribution notices remain a future artifact gate; project licence not selected. Codegeist and Atlassian terms reopened 2026-11-26.

Public review inspected all four reachable initial commits and 140 unique historical blobs, tracked/current changes, path inventories and ignored tooling/artifacts/config boundaries. Provider-token/private-key/credential URL/cookie/password-assignment patterns found no credentials. Personal commit author email and workspace path in three historical audit versions found. Owner explicitly declined publication and history rewrite. Current path/account details redacted; old history preserved privately. No claim of exhaustive/provenance scanner coverage. .env.example is comments only. Ignored tooling, .forge, dependencies/builds/coverage/raw scans/temporary diagnostics/credentials are absent from tracked publication paths. Git local config has only ordinary core settings; no remotes or credential extraction. Required app ID is an identifier, not a credential, and remains untouched.

GitHub owner authenticated; target repo lookup could not resolve an existing repo. No remote creation/push/PR/CI/security-setting change/merge/main sync. Workflow static review: PR/main, exact Node, npm ci/validate, least privilege, action SHA pins/no persisted credentials/no Forge credentials or automatic deploy. Both official v7 refs verified by git ls-remote, exit 0. Free public secret scanning/dependency graph/Dependabot availability reviewed in official docs; actual repository settings/push protection/topics/default branch remain blocked. No paid feature enabled or false badge/CI success added. A PR body is prepared privately as a draft, not submitted.

Public-ready README/security/contribution/operations docs and current acceptance/tracking/risk/changelog updated. foundation-acceptance-report.md records current gates and limitations. Private operational URL/site evidence and local PR draft remain outside the repository. Sprint 1 backlog remains design-ready but blocked by incomplete foundation acceptance and owner decisions; not started. Final formatting/validation/diff/staged secret review and local commit evidence follow; containing commit can be identified with git log -1 rather than a self-referential hash.

Final validation discovered that newly generated `.forge/inspect` wrappers were included by the broad lint/format entrypoints despite being Git-ignored. Validation failed (exit 1; 2,931 generated-code lint errors), so this was not credited as passed. Added a global ESLint `.forge/**` ignore and explicit Prettier `.forge/` exclusion, matching the generated-artifact boundary; application rules/source/tests remain included. The formatter already skipped the saved inspection copies through Git ignore; the explicit exclusion makes the intended boundary durable. The recorded inspection hash remains unchanged. No deployment/runtime code was changed. Final validation was rerun after the exclusions. No third-party fixture was edited, and `.forge` remains untracked. This is a configuration fix within final acceptance, not a new sprint.

Final standalone Forge lint retry exited 1 after a 300,000 ms platform-request timeout. This is recorded as a failed/inconclusive retry; earlier independent official lint and both actual deployment prechecks passed and manifest/source remained unchanged. No verification was bypassed. The explicit Prettier invocation briefly included .prettierignore as an input and returned a no-parser error; reran only supported document/config inputs, then the normal aggregate format gate. No application validation result is inferred from that formatter invocation.

## Final local handover verification

After the .forge exclusion, npm run validate exited 0 with the same ten tests/100% configured coverage/build/manifest results. Final format:check and git diff --check pass. ESLint API confirms .forge/.agents/.codex ignored while source/UI/unit tests/scripts remain included. Relative Markdown destination review found no broken destinations. Manifest, dependencies, lockfile and CI have no diff. Runtime implementation is unchanged; TypeScript emit and generated-artifact check boundaries are the only code/config changes.

A new local acceptance commit uses the authenticated owner's GitHub noreply identity for both author and committer; prior four commits are unchanged. No remote push, history rewriting or account-wide setting change is performed. Final staged-secret/path review is required before that commit.

Changed files in this acceptance commit:

- `.prettierignore`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `SECURITY.md`
- `docs/hackathon/submission-checklist.md`
- `docs/operations/cost-governance.md`
- `docs/operations/deployment.md`
- `docs/operations/development-setup.md`
- `docs/project/acceptance-criteria.md`
- `docs/project/audit.md`
- `docs/project/changelog.md`
- `docs/project/dependency-security-assessment.md`
- `docs/project/foundation-acceptance-report.md`
- `docs/project/risk-register.md`
- `docs/project/sprint-0.6-execution-report.md`
- `docs/project/tracking.md`
- `eslint.config.js`
- `tsconfig.json`

## Authorised unpublished-history cleanup — current continuation

Owner explicitly approved the metadata rewrite, workspace-path redaction and equivalent documentation-only privacy corrections, superseding the earlier hold. Before mutation, verified no configured remote/remote-tracking refs/push reflog and intended authenticated-owner repository 404. No prior publication evidence found; no claim is made about unknown external copies. Created and verified a private Git bundle plus staged/unstaged/files backup outside repository, then retained a durable private copy with restricted permissions. Configured only repository-local verified GitHub noreply email; global Git config unchanged.

Rebuilt four original commits with corrected author/committer email and approved doc placeholders; updated prior ancestor hashes in documentation. Verified exact original messages/names/timestamps/mapped parents; tree differences only in approved documentation, zero application/functional config/manifest changes. Atomically updated main and foundation refs, no backup/original publication refs. Full original/replacement maps and thirty targeted privacy/reference corrections recorded privately. Original commit hashes/refs/backups are not publication inputs.

Repeated history scan: four commits/140 unique blobs, zero bounded secret/path/forbidden-artifact matches; all intended author/committer metadata uses noreply, no Gmail. Genuine app ID preserved. Existing deployment 2.0.0 and installation remain valid because source/config functionality was unchanged. No additional Forge deployment is needed solely for Git metadata. Current documentation corrected to reflect approval; public repository/push/PR/CI continue, conditional merge still awaits runtime and actual CI.

Final post-cleanup validation: npm run validate exit 0; repeated format:check exit 0; history scan zero bounded findings. The final acceptance commit covers 18 intended files after restaging corrected references; an intermediate index review counted 21 before redundant historical-reference changes were restaged; no secrets, private site/path/email, original refs, backups, tooling or generated artifacts are proposed. Only refs/heads/main and refs/heads/sprint-0/engineering-foundation exist. Earlier pre-cleanup changed-file inventory is superseded by:

- `.prettierignore`
- `AGENTS.md`
- `CONTRIBUTING.md`
- `README.md`
- `SECURITY.md`
- `docs/hackathon/submission-checklist.md`
- `docs/operations/cost-governance.md`
- `docs/operations/deployment.md`
- `docs/operations/development-setup.md`
- `docs/project/acceptance-criteria.md`
- `docs/project/audit.md`
- `docs/project/changelog.md`
- `docs/project/dependency-security-assessment.md`
- `docs/project/foundation-acceptance-report.md`
- `docs/project/risk-register.md`
- `docs/project/tracking.md`
- `eslint.config.js`
- `tsconfig.json`

## Public repository, branches and PR — actual execution

After repeated cleaned-history/current-source review passed, created https://github.com/FRANKD-UX/light-house with explicit PUBLIC visibility and the approved description, no initial licence/README/history. Remote uses the approved SSH URL. Pushed only cleaned main and sprint-0/engineering-foundation, no force/mirror/backup/original refs. Foundation acceptance commit 85f542c uses verified noreply metadata; source/manifest/dependency/CI checks unchanged. PR #1 created at https://github.com/FRANKD-UX/light-house/pull/1 with actual evidence and explicit pending runtime gates. No merge performed at this checkpoint.

Repository metadata independently reports PUBLIC, owner administrative permission and default branch main. All ten requested topics configured. Public secret scanning and push protection report enabled. Enabled Dependabot alerts (verified GET HTTP 204) and private vulnerability reporting (enabled true), using free repository features only. Configured main protection requiring the validate status, up-to-date branches, admin enforcement, conversation resolution, no force pushes/deletions; merge-commit method enabled and squash/rebase disabled to retain cleaned foundation history. Actual remote CI outcome and final repo settings are recorded after run completion; no success inferred from configuration.

Actual remote CI run 45775501033 exited successfully: https://github.com/FRANKD-UX/light-house/actions/runs/45775501033, head 85f542cf6322653495b4e10b717167bbc3d7ccb1, completed 07:28:20Z. validate job checkout/setup-node/npm ci/npm run validate and cleanup all success. PR #1 remains OPEN with CLEAN merge state; manual typed-response/frontend errors/themes are still pending, so no merge. Public security settings and main protection were read back and verified. Sandboxed SSH verification failed on system config permissions; supported elevated verification succeeded, showing only cleaned main/foundation plus GitHub-generated clean PR refs, no backup/original refs. Final evidence-only documentation commit is validated by a new actual PR run; final head/run identifiers are reported in the PR and handover.

Independent fresh PUBLIC HTTPS clone verification: intended branches contain only cleaned noreply metadata; repeated reachable-history scan reports zero bounded privacy/secret/forbidden-path findings. None of the four original commit objects is present in the fresh clone. Private recovery data and original refs were not published. This verifies the published history independently of local reflogs/dangling recovery objects.
