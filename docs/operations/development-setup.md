# Development setup

Updated 2026-11-26 for Sprint 0.6. Verified Node 22.23.4, npm 10.9.9, Forge CLI 16.0.0 and GitHub CLI 2.92.0. Owner reports NVM 0.41.0 and a clean 332-package installation. Preserve the existing registration and app ID; never repeat registration or scaffolding.

```sh
nvm use
npm ci
npm run validate
forge --version
forge whoami
forge environments list
forge lint --non-interactive
```

Ordinary local checks need no Atlassian credentials. Sandboxed Forge authentication initially failed with a credential-store error; supported elevated execution succeeded during final foundation acceptance. Use the existing owner authentication through the supported permission mechanism. Never extract credentials or configure tokens in chat. If login is required, use `forge login` privately in the owner terminal. No credentials are needed for CI.

The root TypeScript configuration permits emit for Forge's ts-loader and directs any compiler output into ignored `dist/typescript`. Local type checking still explicitly runs `tsc --noEmit`. Forge deploy bundles the source handler; `dist/backend` is a local smoke artifact. This fixes the demonstrated deployment bundling failure without changing runtime behaviour or compiler strictness.

## Reproducing optional official agent tooling

Forge CLI 16.0.0 provides the following commands (help/status verified locally):

```sh
forge skills install --agent codex --scope project --dry-run
forge skills install --agent codex --scope project
forge skills status --non-interactive
sha256sum .agents/skills/*/SKILL.md
```

Install is an optional owner/local setup step, never an npm lifecycle or CI prerequisite. It selects latest skills; the CLI does not expose pinned per-skill versions in the installed inventory. Record hashes/review changes after installation; do not claim a CLI version pins skill content. The seven actual names and hashes are in the Sprint 0.6 report. Existing installation and config were preserved; no reinstall was run.

.agents/ and .codex/ are ignored and untracked, with no files in the Git index. Keep them local. Reviewed .codex/config.toml contains only the official Forge and ADS HTTPS MCP URLs, no credentials, shell commands or unsafe permission overrides. Forge MCP and ADS MCP both answered in this session. Do not force-add this machine config; document URLs and commands instead. Skill evaluation fixtures are intentionally unsafe reference inputs, not app code/tests.

## Validation and packaging boundaries

| Tool                        | Application scope and boundary                                                                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint 10.15.0              | eslint . with supported globalIgnores from eslint/config; .agents/**, .codex/**, .forge/** and generated scan artifacts excluded along with dependencies/build/coverage. All existing application rules retained; 21 files linted. |
| Prettier 3.10.1             | Repository docs/config/source remain checked; explicit tooling/artifact ignores including .forge/, existing lockfile/generated ignores retained.                                                                                   |
| TypeScript 6.0.3            | Explicit src, static/app/src, tests and Vite/Vitest config include list; no tooling files.                                                                                                                                         |
| Vitest 5.1.1 / V8 coverage  | tests/unit only; implemented src and App.tsx coverage, unchanged thresholds; contract/integration directories remain documented future gates.                                                                                      |
| Vite 8.3.8 / esbuild 0.28.2 | static/app root and src/index.ts entry; no tooling imports. dist/ui resource only; backend dist is a smoke artifact.                                                                                                               |
| npm audit                   | Application package-lock only, both full and omit=dev. Does not audit optional skills or global CLI tools; those are separate supply-chain surfaces.                                                                               |
| Forge                       | Default handler dependency bundling plus declared Custom UI resource; no manual package or extraFiles. Official artifact inspection remains pending; Git ignore alone is not a deployment exclusion.                               |
| Security review             | Independent source and proposed-commit secret review remains mandatory regardless of formatter/linter ignores. Scan artifacts stay local; durable conclusions go in audit/assessment.                                              |

Verified ESLint API reports tooling ignored and src/index.ts, App.tsx, tests, scripts and Vite/Vitest/ESLint config included. No source, tests, dependency versions or lockfile changes were needed. No pretend behaviour tests were added for this configuration-only correction.

## Public GitHub and CI readiness

The owner originally authorised a PUBLIC `FRANKD-UX/light-house` repository, superseding the earlier private proposal. The owner subsequently authorised and completed controlled unpublished-history cleanup for email metadata and documentation privacy details. Repeated review passed. Public creation/push/PR/CI may proceed under the existing authorisation; merge still requires actual runtime and CI acceptance. No backup refs/private recovery material may be published. The intended SSH remote is `git@github.com:FRANKD-UX/light-house.git`; this is a target, not an existing published repository.

The existing `Validate` workflow runs on pull requests and pushes to main, pins action SHAs, uses Node from `.nvmrc`, runs `npm ci` and `npm run validate`, grants only contents:read, disables persisted checkout credentials and has no deployments or Atlassian credentials. Remote CI evidence must be recorded after actual execution; no successful run is inferred from local checks.

Dependency auditing is a separate, visibly failing security gate. Run `npm audit` and `npm audit --omit=dev` separately; record exit codes and LH-014. Do not label a tolerated audit as a successful security check. A development exception cannot satisfy staging/production security acceptance.

The cleaned candidate history has been reviewed; repeat the check after any further history/content change. Preserve the main baseline and foundation branch ancestry unless the owner explicitly authorises otherwise. After successful publication: verify PUBLIC visibility and ownership, configure free security protections, create the PR, wait for actual CI, and merge with a merge commit only after installed runtime acceptance and all mandatory gates pass. Exact current commands and blockers are in the [acceptance report](../project/foundation-acceptance-report.md).
