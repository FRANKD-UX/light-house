# Engineering audit — 2026-11-24

## Repository baseline

Working directory: `[local light-house checkout]`. Initial repository had no tracked files, commits, remotes or existing package configuration; main was unborn and status was clean. Reserved read-only `.agents`, `.codex` and `.aws` surfaces were preserved and excluded from source control. No existing repository AGENTS.md applied.

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
