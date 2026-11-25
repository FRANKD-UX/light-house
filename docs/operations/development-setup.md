# Development setup

Use Node 22.23.4 from `.nvmrc`. System inspection found Node 22.22.1 and npm 9.2.0; current Forge CLI 16 requires a newer Node patch. GitHub CLI 2.92.0 is present but no remote is configured. No credentials are needed for local quality gates.

```sh
nvm install
nvm use
npm ci
npm run validate
```

If the default npm cache is read-only, use `npm --cache /tmp/light-house-npm-cache ci`. This session installed a portable Node and Forge CLI under `/tmp/light-house-forge-tools` without changing the user's Node installation. Temporary tools/configuration are not part of the repository or a reproducible project dependency; owner setup uses the pinned CLI below.

```sh
npm install -g @forge/cli@16.0.0
forge --version
forge login
forge register
npm run build
forge lint
```

Login is interactive; enter credentials privately. Registration must select the owner's actual developer space and produce the real `app.id`. No ARI may be copied from examples. Check and commit that non-secret identity change after registration. This manifest is intentionally incomplete for deployment until that step. The official Custom UI tutorial and module definitions were used as references rather than invoking create/register behind the owner's account.

Scaffold scripts: lint, format:check, typecheck, test, test:coverage, build, validate and check:manifest. `npm run format` repairs formatting. UI resources build to `dist/ui` with relative URLs; backend compilation is a local smoke build, not Forge's deployment bundle. The Bridge resolver works only in the installed host; a standalone preview honestly shows unavailable when Bridge fails.

No `.env` values are required. Future credential configuration goes through an authorised backend and KVS secret store. Never place secrets in Vite variables: frontend build variables are public. Deployment instructions are a separate gate in deployment.md.

## Sprint 0.5 remote/CI readiness — 2026-11-25

No Git remote is configured. GitHub CLI 2.92.0 is authenticated to github.com as FRANKD-UX; this is not permission to create a repository or push. Workflow `.github/workflows/ci.yml` reviewed locally: all pull requests, pushes to main, `npm ci`, Node from `.nvmrc` 22.23.4, ten-minute job timeout, contents:read, checkout persist-credentials:false, no secrets and no deploy. Action commit pins were independently matched to official v7 tags with `git ls-remote` (checkout `3d3c42e5aac5ba805825da76410c181273ba90b1`, setup-node `949feb2413d6458794dcd2491c4babbbce0c15c1`). Local YAML inspection is not successful GitHub Actions execution. No workflow changes were needed. Dependency audit remains an explicit release gate outside aggregate validate; `npm ci` reports the findings without failing installation.

Only after owner authorises creating a private remote, check the target name is unused, then:

```sh
gh repo view FRANKD-UX/light-house
# If genuinely absent (not an authentication/network error), create:
gh repo create FRANKD-UX/light-house --private --source=. --remote=origin
```

No `--push` is included. After separate push authorisation:

```sh
git push -u origin main
git push -u origin sprint-0/engineering-foundation
gh pr create --base main --head sprint-0/engineering-foundation --title 'Light House engineering foundation and Sprint 0.5 stabilisation' --body 'Adds the Forge scaffold, architecture and stabilisation evidence. External Forge/runtime and dependency release gates remain documented.'
gh run list --workflow ci.yml
gh run view --exit-status
```

Inspect the actual PR/main runs and record their URLs/results before marking remote CI accepted. Repository creation/push/PR commands above are owner follow-up only and were not executed. No CI deployment credentials should be added for ordinary gates.
