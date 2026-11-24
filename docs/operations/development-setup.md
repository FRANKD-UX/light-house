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
