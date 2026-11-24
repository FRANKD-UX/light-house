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
