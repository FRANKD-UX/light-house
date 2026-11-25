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

Ordinary local checks need no Atlassian credentials. In this restricted execution environment Forge whoami, environment listing, installation listing and lint exit 1 because the CLI cannot securely access/store its local credentials file. The owner's authenticated terminal is a separate environment; retry there first, without re-registering. If login is needed, run forge login interactively and enter credentials privately. Do not paste tokens into chat or commit them. No token/config extraction was attempted. A read-only npm cache may be redirected with npm --cache /tmp/light-house-npm-cache; Sprint 0.6 audits/registry lookups needed that override.

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

| Tool                        | Application scope and boundary                                                                                                                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint 10.15.0              | eslint . with supported globalIgnores from eslint/config; .agents/**, .codex/** and generated scan artifacts excluded along with dependencies/build/coverage. All existing application rules retained; 21 files linted. |
| Prettier 3.10.1             | Repository docs/config/source remain checked; explicit tooling/artifact ignores, existing lockfile/generated ignores retained.                                                                                          |
| TypeScript 6.0.3            | Explicit src, static/app/src, tests and Vite/Vitest config include list; no tooling files.                                                                                                                              |
| Vitest 5.1.1 / V8 coverage  | tests/unit only; implemented src and App.tsx coverage, unchanged thresholds; contract/integration directories remain documented future gates.                                                                           |
| Vite 8.3.8 / esbuild 0.28.2 | static/app root and src/index.ts entry; no tooling imports. dist/ui resource only; backend dist is a smoke artifact.                                                                                                    |
| npm audit                   | Application package-lock only, both full and omit=dev. Does not audit optional skills or global CLI tools; those are separate supply-chain surfaces.                                                                    |
| Forge                       | Default handler dependency bundling plus declared Custom UI resource; no manual package or extraFiles. Official artifact inspection remains pending; Git ignore alone is not a deployment exclusion.                    |
| Security review             | Independent source and proposed-commit secret review remains mandatory regardless of formatter/linter ignores. Scan artifacts stay local; durable conclusions go in audit/assessment.                                   |

Verified ESLint API reports tooling ignored and src/index.ts, App.tsx, tests, scripts and Vite/Vitest/ESLint config included. No source, tests, dependency versions or lockfile changes were needed. No pretend behaviour tests were added for this configuration-only correction.

## Private GitHub repository and CI readiness

GitHub authentication is available; no remote is configured. No remote repository was created or queried for availability. CI uses Node from .nvmrc, npm ci and npm run validate, contents:read, no persisted checkout credentials, ten-minute timeout, no Forge auth/skills/deploy. Official v7 action SHAs were reverified with git ls-remote on 2026-11-26. Remote execution remains untested. Audits deliberately remain visible separate security gates; validate passing does not accept LH-014.

Only after owner authorises repository creation, check availability (distinguish absent repository from network/auth failure):

```sh
gh repo view FRANKD-UX/light-house
# Only if genuinely absent and creation authorised:
gh repo create FRANKD-UX/light-house --private --source=. --remote=origin
```

Only after push/PR authorisation:

```sh
git push -u origin main
git push -u origin sprint-0/engineering-foundation
cat > /tmp/light-house-pr.md <<'PR'
Preserves the owner-registered Light House identity and isolates optional Forge agent tooling from application validation. Adds Sprint 0/0.5 architecture and scaffold plus Sprint 0.6 acceptance evidence and deployment procedures.

Local checks pass with 10 tests and 100% configured implemented-code coverage. LH-014 remains open; official CLI lint, deployment, installed runtime and remote CI gates remain pending as recorded in the Sprint 0.6 report.
PR
gh pr create --base main --head sprint-0/engineering-foundation --title 'Light House engineering foundation and tooling stabilisation' --body-file /tmp/light-house-pr.md
gh run list --workflow ci.yml
# Substitute an actual run ID:
gh run view RUN_ID --exit-status
```

PR/merge checklist: inspect the complete Sprint 0 branch diff; preserve real app ID; no credentials, skill fixtures or generated artifacts; local validation and both audits recorded; actual PR CI run succeeds; official lint blocker resolved before deployment; owner LH-014 disposition remains explicit; required reviews/branch protection chosen by owner; merge approval does not authorise deploy or start Sprint 1. No push, PR or merge has occurred.
