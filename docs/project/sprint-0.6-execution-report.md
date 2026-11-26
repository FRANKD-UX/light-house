# Sprint 0.6 execution report — 2026-11-26

## Executive summary

Local tooling stabilisation, validation and review are complete. The genuine registered identity is preserved; third-party Forge skill fixtures no longer enter application linting. All eight requested local gates pass, with the existing ten tests and 100% coverage within the configured implemented-code scope. Official Forge lint was attempted but cannot access/store credentials from this restricted Codex environment; it did not validate the app. LH-014 remains open. Deployment, installation, official artifact/runtime and remote CI acceptance remain pending. Sprint 1 was not started.

## Repository and owner baseline

Entry branch sprint-0/engineering-foundation; HEAD fee2896 (Sprint 0.5), preceding 315200a and ff2939c. Ninety-four tracked files at entry; only manifest.yml modified, adding the genuine app ID. No remotes. .agents/ and .codex/ are Git-ignored/untracked, not staged or committed. Registration ID retained exactly: ari:cloud:ecosystem::app/1ef4af03-f1ed-4498-a83e-1a8978cf5430. No registration/create operation executed. Previous audit/tracking/README assertions that registration is absent are historical and current-facing docs were corrected.

Owner-supplied verified results: NVM 0.41.0, Atlassian authentication, the owner-controlled Developer Space, app registration and three environments, seven official skills/MCP setup and clean installation of 332 packages. Independently executed versions: Node v22.23.4, npm 10.9.9, Forge CLI 16.0.0, gh 2.92.0. GitHub auth status exit 0 (credential keyring available; no token extracted). Forge whoami/environments/install-list exit 1 because its credential store is inaccessible here; no owner-terminal failure inferred. Authenticated console correspondence/environment listing remain independently unverified. Owner confirms a suitable JSM development site exists and will identify it before deployment; no site created or real URL recorded.

## Official Forge skills and MCP

forge skills status --non-interactive exits 0, showing Codex skills/MCP at project scope. Inventory .forge-skills.json and directories confirm seven names below. No per-skill version/release is declared in installed SKILL.md or inventory; do not invent one. CLI version 16.0.0 does not pin remotely installed latest skill content. SHA-256 fingerprints identify the instructions actually inspected:

| Installed skill       | SKILL.md SHA-256                                                 |
| --------------------- | ---------------------------------------------------------------- |
| forge-app-builder     | 3cac8fd0028e2c314d9255dc2e169d886502ee7852cd4592bfc8a7454810727b |
| forge-app-review      | c830942585bf03201107c86e4a964bb40c649781e1814f53095064a069574f87 |
| forge-connector       | a9b1289f899d9e1e0c6ec8ae15e9b6758a5ff447bd13c78a4d1ec783983a7048 |
| forge-cost-optimizer  | 027e9ad0452072b94f31a04eb5487ec9190b307e02e78ba2817950812f375d06 |
| forge-debugger        | b5b05d11d3a5ac7f9550e2ea6eb5b2aeb54d815b13a7a8996baed6250d68ad5d |
| forge-onboarding      | 1ae11037bf70ac060953e16c59928817d28d5c95f90c879e07e2e66fc06c41ac |
| forge-security-review | 34c666a37ea0a674e26d7b56e02ac27a2e45cf29fbe7a1a5515c8d836a9146ce |

Builder/release/environment references applied to platform verification; debugger to the known lint boundary; app-review to deployment readiness; security-review to actual code and deterministic scanners; cost-optimizer to governance. Onboarding instructions inspected and correctly skipped because they build Forge Guru/Rovo; connector inspected for routing only and excluded. No Teamwork Graph, GraphQL, runtime Rovo/LLM, new dependency or app feature introduced. Read applicable SKILL.md before future use; reproduce optional installation with commands in development-setup.md.

.codex/config.toml contains only https://mcp.atlassian.com/v1/forge/mcp and https://mcp.atlassian.com/v1/ads/public/mcp. No credentials, commands or permission overrides found. Neither local config nor skills should be force-added. Forge manifest guide and focused packaging/pricing/storage searches returned results using genuine appId; ADS lint-rule documentation returned a result. This establishes MCP availability, not app account access. All examples/tool outputs treated as reference evidence subject to project constraints.

## ESLint root cause and boundaries

eslint . traversed installed third-party security evaluation fixtures because flat config does not automatically adopt Git ignores. User-supplied failure was 30 fixture errors; not reproduced by modifying fixtures. ESLint 10.15.0 supports globalIgnores from eslint/config; added global .agents/** (including skills and other local agent tools), .codex/**, and generated security-audit-artifacts/** with existing dist/coverage/dependency ignores. No legitimate source directory or rule disabled. The parent .agents/** includes the required .agents/skills/** scope.

Prettier explicitly excludes tooling/artifacts; Git ignores generated scanner artifacts alongside already ignored tooling. TypeScript positive includes, Vitest unit selection/coverage and build entrypoints already exclude tooling and were retained. ESLint API verifies fixture/config/artifact paths ignored while app source, frontend, tests, scripts and configuration remain included; 21 actual files linted. No third-party fixtures edited. npm audit scans app lockfile, not global CLI or skill packages. Full independent proposed-commit secret review still applies to all proposed files, even ignored ones. See development-setup.md for the full scope matrix and reproduction policy.

## Quality gates and automated tests

Each command was executed independently, with no && masking other results; final aggregate repeated after documentation formatting:

| Command                                                        | Exit   | Actual outcome                                                    |
| -------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| npm run lint                                                   | 0      | Application rules unchanged; 21 files in scope                    |
| npm run format:check                                           | 0      | Matched app/config/documentation formatting passes                |
| npm run typecheck                                              | 0      | Strict TypeScript                                                 |
| npm run test                                                   | 0      | 3 files, 10 tests, 0 failures                                     |
| npm run test:coverage                                          | 0      | Same 10 tests, 100% configured coverage                           |
| npm run build                                                  | 0      | Vite Custom UI and esbuild backend smoke artifacts                |
| npm run check:manifest                                         | 0      | Local wiring/resources check, not full schema/platform validation |
| npm run validate                                               | 0      | Aggregate lint/format/types/coverage/build/local manifest         |
| npm --cache /tmp/light-house-npm-cache audit --json            | 1      | 8 packages, 5 high/3 moderate                                     |
| npm --cache /tmp/light-house-npm-cache audit --omit=dev --json | 1      | Same 8 packages                                                   |
| forge lint --non-interactive                                   | 1      | Credential-store access failure before lint; exact message below  |
| forge whoami / forge environments list / forge install list    | 1 each | Same credential-store blocker                                     |
| forge skills status --non-interactive                          | 0      | Codex project skills/MCP                                          |
| Unchanged security launcher copy (final run)                   | 0      | FSRT/OpenGrep complete; initial attempts exit 1 documented        |

Coverage: statements 24/24, branches 8/8, functions 13/13, lines 22/22; seven files fully covered, five empty/type-only files skipped. Resolver tests explicitly mock SDK; UI tests mock Bridge, cover loading/success/failure and resolve/reject after unmount. Logger allowlisting, safe errors and internal UUIDs tested. No implemented tenant/persistence/integration or installed-runtime coverage claimed. No new tests added because this is a reversible tooling/config/documentation change, no application behaviour change.

Build: 152 UI modules transformed; index HTML 0.39 kB, CSS 0.43 kB, main JS 205.25 kB (gzip 64.80), iframe-resizer JS 29.18 kB (gzip 10.27); backend approximately 3.0 kB. Fresh emitted graphs: UI 152 inputs, backend 6 (resolver external) / 7 (fully bundled). No affected vulnerable leaves or agent tooling inputs. These are local build graphs, not official Forge archives.

## Official Forge lint and packaging

Exact CLI error: “The CLI couldn't securely store your login credentials in the local credentials file.” The CLI suggests environment-based credentials; none extracted, printed or created. Owner should retry in their authenticated terminal first. Local app ID syntax/existence and manifest/source wiring inspected; official schema validation, authenticated permission checks and packaging not credited. Node nodejs22.x, one global page, resource dist/ui, index.handler and matching getStatus wiring reviewed. Empty scopes match the read-only public status surface.

forge build --help and forge deploy --help inspected. Official build --inspect uploads and deploy --inspect deploys; no supported purely local packaging command established. Neither executed. Installed CLI runtime-bundler code and official packaging docs support handler-dependency bundling plus explicit resources/extraFiles; no broad resource/manual packaging/extraFiles configured. Tooling absent from local graphs but official archive acceptance pending. No credential workaround or deployment was used to make this gate appear passed.

## Official application review

Readiness: **blocked for deployment pending prerequisites**. Highest-risk area is dependencies; security and cost specialist reviews performed. Files inspected: manifest, package/lockfile/config/scripts, all src, frontend and tests. Findings from installed forge-app-review checklist:

| Severity | Source       | Finding                               | Location and evidence                                                                                      | Description / fix                                                                                                                                                 | Doc                                                                                        |
| -------- | ------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Warning  | dependencies | LH-014 open                           | package.json:22-23 <pre><code>"@forge/bridge": "7.4.0",<br>"@forge/resolver": "2.0.2"</code></pre>         | Bridge inherits affected chains; retain release gate and explicit owner disposition. See dependency-security-assessment.md.                                       | [Advisories](dependency-security-assessment.md)                                            |
| Warning  | general      | Official lint/runtime gate pending    | manifest.yml:20 <pre><code>id: ari:cloud:ecosystem::app/1ef4af03-f1ed-4498-a83e-1a8978cf5430</code></pre>  | Correct registration preserved; credential-store blocker prevents official lint, not resolved by valid-looking ID. Use owner-terminal procedure in deployment.md. | [Forge lint](https://developer.atlassian.com/platform/forge/cli-reference/lint/)           |
| Info     | frontend     | Fulfilled invoke is availability only | static/app/src/App.tsx:12-14 <pre><code>.then(() => {<br> if (active) setStatus('available');</code></pre> | Runtime acceptance separately inspects actual response contract; no extra app feature required.                                                                   | [Custom UI](https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/) |

Clean areas reviewed: module/resource/export and invoke name wiring, least privilege/no egress, public metadata only, safe backend/frontend separation, bounded logs, honest unconfigured UI, appropriate current unit tests. Installed runtime and future tenant enforcement remain unverified. [Official Custom UI](https://developer.atlassian.com/platform/forge/build-a-custom-ui-app-in-jira/) and [packaging](https://developer.atlassian.com/platform/forge/manifest-reference/packaging/) consulted with Forge MCP, verified 2026-11-26.

## Security and dependency disposition

Manual actual-code review plus pinned FSRT v0.1.1 and OpenGrep 1.16.2 complete; no confirmed exploitable application finding established. OpenGrep: 44 rules/19 app/config files, zero findings/errors, third-party fixtures excluded; six standard-ignore files skipped. FSRT zero findings, imprecise [""] scanned field; debug follow-up confirms backend traversal. No Snyk/gitleaks (not installed), deployed checks or exploit claims. Loaded global/auditing/misc/composition rules; absent feature categories and exact gaps recorded in dependency-security-assessment.md. Initial scanner failures came from read-only skill/cache/log paths; final unchanged /tmp copy with SEMGREP_LOG_FILE/settings/cache overrides completed. Fixtures untouched.

Current audits/registry/advisories reconfirm glob 13.0.7, minimatch 10.2.6, view 1.41.5 and affected Forge/Atlaskit parents. No supported fix in latest pinned tree; no override/downgrade/force fix. Leaf functionality absent from local emitted graphs but development tool exposure and official artifact/runtime uncertainty remain. Proposed risk owner is project owner/maintainer; bounded development-only acceptance could be considered with exact site, low synthetic traffic, lint, billing review, artifact inspection and explicit deploy/install approval. Proposed expiry 2026-12-03 or earlier on new upstream/advisory/dependency/feature/artifact/promotion change. **No acceptance recorded. Development remains blocked until prerequisites; production release remains blocked and needs a separate refreshed decision.**

## Cost and environment governance

Cost audit completed, governance updated with dated official allowances/rates, app-vs-space billing distinction, all-environment metering, future SQL/KVS/events/schedules/log controls and conservative planning model. Current resolver remains a deliberate smoke check; no storage/trigger/memory change. Billing console/payment/recipients and actual metrics remain owner actions; alerts are not a guaranteed spending cap. No paid resource/configuration changes made.

Promotion proposal: same reviewed source/app ID from active development to staged release-candidate regression/security/rehearsal, then owner-approved competition-verified production distribution. Versions/configuration/storage remain environment/installation scoped; do not copy secrets/data implicitly. Future migrations require independent schema readiness and forward repair, not presumed rollback. No database implemented or migrations run. See cost-governance.md and deployment.md for official URLs verified 2026-11-26 and owner procedures.

## GitHub and CI readiness

No remote or remote mutations. GitHub auth works; private FRANKD-UX/light-house availability/creation not performed. Workflow reviewed: application-only npm ci/validate, Node .nvmrc, no Forge credentials/skills or deploy, least-privilege permissions and immutable action pins. git ls-remote confirms official checkout/setup-node v7 pins match workflow. Exact authorised create/remote/push/PR/run commands and PR merge checklist prepared in development-setup.md. Remote Actions execution remains pending.

## Files, commit and remaining gates

Changed files: AGENTS.md, README.md, .gitignore, .prettierignore, eslint.config.js, manifest.yml; docs/operations/{development-setup,deployment,cost-governance}.md; docs/project/{tracking,audit,changelog,dependency-security-assessment,risk-register,acceptance-criteria,sprint-0.6-execution-report}.md. No application/test/dependency/lockfile/CI change. Existing registration is the only owner tracked change and is included legitimately. Ignored scanner artifacts/tool copies are not committed. Dependency license/engine review is unchanged because no dependencies changed.

Local commit on existing sprint branch is authorised, not a remote push. Identify the commit containing this report with git log -1 --format='%h %s'; its own hash cannot be embedded in the same commit. Commit message: chore: stabilise Forge tooling and record Sprint 0.6 acceptance. Staged review and post-commit clean-tree results are in audit/final handover.

Remaining blockers: official lint/authenticated inspection from owner terminal; LH-014 owner decision; exact existing JSM site/rights and billing review; explicit deployment/install approval; official archive and installed Bridge/response/log/CSP acceptance; authorised private remote/push/actual CI. Production acceptance and competition distribution remain later gates. Local checkpoint may be handed over with these precise blockers; it is not complete platform acceptance or Sprint 1 readiness.

## Exact next owner commands

In the already-authenticated owner terminal, without registering again:

```sh
nvm use
npm ci
npm run validate
forge whoami
forge environments list
forge lint --non-interactive
forge install list
npm audit
npm audit --omit=dev
git log -1 --format='%h %s'
git status --short
```

Run gates independently and record exits. Review LH-014 proposal, billing console and identify the existing authorised JSM site. Deployment/install commands in deployment.md require explicit authorisation and prerequisites; remote commands in development-setup.md require separate authorisation. No need to rerun the onboarding tutorial. Sprint 1 remains unstarted; owner must explicitly initiate it after its platform/persistence prerequisites and proposed ADR decisions are addressed.

## Task acceptance ledger

| Task                         | Completion status                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| A: repository/environment    | Inspected; owner changes preserved. Registration local/owner evidence accepted, authenticated platform listing blocked here.    |
| B: skills/MCP                | Seven installed names/fingerprints assessed; relevant skills applied, both MCP servers respond. No prohibited capability added. |
| C: tooling                   | Corrected global lint/format boundaries and documented local tooling reproduction/security policy.                              |
| D: local validation          | All eight requested commands exit 0; baseline maintained.                                                                       |
| E: official Forge validation | Attempted, exit 1 exact credential-store blocker. No schema/package/deploy/runtime pass claimed.                                |
| F: security                  | Manual review/scanners/audits/reachability reassessment complete; LH-014 recommendation prepared, acceptance pending owner.     |
| G: cost                      | Official documentation and conservative usage/monitoring model documented; owner console review pending.                        |
| H: environments              | Promotion/isolation/config/secrets/migration policy documented; live acceptance pending.                                        |
| I: remote/CI                 | Auth/remotes/workflow inspected; private-repo/PR/merge procedure prepared, no external mutation/run.                            |
| J: development deployment    | Complete acceptance procedure prepared; existing JSM site owner-confirmed, exact site/prerequisites/authorisation pending.      |
| K: documentation/commit      | Requested docs updated and report created; local commit/staged review evidence in audit and final handover.                     |
