# Deployment and installation gates

## Current foundation acceptance — 2026-11-26

This section supersedes historical pending-authorisation and credential-store notes below. Supported elevated execution authenticated successfully; environments were listed, deployment history was initially empty, development installation list was initially empty, and `forge lint --non-interactive` exited 0 with no issues. The genuine manifest app ID is unchanged.

The first deployment failed in bundling because root `noEmit` prevented Forge ts-loader output. The CLI process misleadingly returned 0 after reporting that failure and a telemetry timeout; no successful deployment was credited. Root config now permits emit to ignored `dist/typescript`; local `tsc --noEmit` remains unchanged. After passing validation, the development retry succeeded at **2.0.0**. No staging/production deployment occurred. There is no SQL/KVS module, migration, schedule, remote or external call in this scaffold and no paid resource provisioning was requested.

`forge deploy --environment development --inspect --non-interactive` saved the official backend bundle in ignored `.forge/inspect`. Eight files were inspected, including runtime wrappers, application code, source map, manifest and package metadata. Application source map: 13 sources, no glob/minimatch/prosemirror-view module source and no local agent fixtures. Pattern review found no credentials. The copied lockfile still contains vulnerable dependency records. The backend inspection is not a complete downloadable server-side archive or proof about every platform runtime dependency; declared frontend resources were reviewed separately.

The confirmed development installation target is recorded privately for the owner. Public setup examples must use a placeholder and must not authorise arbitrary installs:

```sh
forge whoami
forge environments list --non-interactive
forge deploy list --non-interactive
forge install list --environment development --non-interactive
forge lint --non-interactive
# Only after all gates pass and the target has explicit owner approval:
forge deploy --environment development --inspect --non-interactive
forge install --site example.atlassian.net --product jira --environment development --non-interactive
```

If an installation already exists, inspect its version before deciding whether a supported upgrade is required; do not reinstall blindly. Do not use `--no-verify`. Installed runtime evidence remains a separate acceptance gate in the [report](../project/foundation-acceptance-report.md).

## Historical Sprint 0.6 procedure and evidence

Updated 2026-11-26, Sprint 0.6. Owner registration is complete in the owner-controlled Developer Space; manifest retains ari:cloud:ecosystem::app/1ef4af03-f1ed-4498-a83e-1a8978cf5430. The owner reports development, staging and production environments created. Independent authenticated listing is blocked by this execution environment's credential-store access, not evidence of failed owner registration. Never register/create another app. No deployment, installation or live integration was performed here.

## Gate separation

| Gate                            | Sprint 0.6 evidence                                                                                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local manifest wiring/resources | npm run check:manifest exit 0; built dist/ui/index.html, global page/resource/function references, nodejs22.x and empty scopes checked. This script is not full Forge schema validation.                        |
| Official Forge CLI lint         | forge lint --non-interactive exit 1 before validation: CLI cannot securely access/store its local credentials file. Run in owner's authenticated terminal; no lint pass claimed.                                |
| Authenticated platform checks   | whoami, environments list and install list exit 1 for the same credential-store blocker. App ID existence verified locally; owner-console correspondence accepted as owner evidence, not independently queried. |
| Official artifact inspection    | Pending. CLI 16 help and official docs expose forge build --inspect (packages and uploads) and forge deploy --inspect (deploys); no supported purely local packaging command found. Neither executed.           |
| Deployment                      | Not authorised/executed.                                                                                                                                                                                        |
| Installed runtime               | Not executed; mocked SDK tests are not substitutes.                                                                                                                                                             |

Manifest review: one jira:globalPage -> light-house-ui -> dist/ui; resolver status-resolver -> index.handler -> src/index.ts -> status resolver. Frontend invoke('getStatus') matches resolver.define('getStatus'). No product API, SQL, storage, trigger, remote, egress or custom CSP permission required by current code; scopes remain empty. Node 22 is documented supported; no runtime migration is needed for this checkpoint.

Default Forge packaging compiles/bundles handler dependencies. CLI 16 runtime-bundler.js inspection confirms handler entrypoints, bundled outputs, manifest/dependency metadata and explicit extraFiles, not a wholesale repository archive. No extraFiles/manual packaging is configured and no app code imports tooling. Local UI and backend graphs contain no .agents/.codex or affected leaves. This is boundary evidence, not official archive verification. During the first authorised deployment inspect .forge/inspect privately for unexpected files and vulnerable paths before crediting the artifact gate; stop distribution if unexpected content appears.

## First development acceptance procedure

Prerequisites: preserve real ID; pass local checks and official lint; resolve LH-014 with a supported fix or explicit owner development-only risk disposition; review scanner limitations; owner confirms exact site, site administration rights, synthetic-only use, billing review and explicit deploy/install authorisation. No blanket risk acceptance is implied by this document.

Run read-only/local preparation in the owner's authenticated terminal:

```sh
nvm use
npm ci
npm run validate
npm audit
npm audit --omit=dev
forge whoami
forge environments list
forge lint --non-interactive
forge install list
```

Audits currently exit 1; record output and owner disposition, do not chain them in a way that hides later gate results. If whoami fails in the owner's own terminal, run forge login there interactively; never share tokens. Do not repeat registration.

Only after prerequisites and explicit authorisation, substitute the confirmed site for the reserved example:

```sh
npm run build
forge deploy --environment development --inspect
forge install --environment development --site example.atlassian.net --product jira
forge logs --environment development --since 15m --limit 50 --grouped
```

If an installation already exists, inspect its version/permissions; use forge install --upgrade with the same explicit environment/site/product only when required and authorised. No --no-verify or automatic approval flags. Capture exits and version, inspect artifact listing, then execute every check below:

| Acceptance check   | Required actual evidence                                                                                                                                                          | Current result |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Deployment         | CLI exit 0, app/environment/version/date match approved target                                                                                                                    | Pending        |
| Installation       | CLI exit 0, authorised Jira/JSM site and expected permissions                                                                                                                     | Pending        |
| Page accessibility | Jira Apps -> Light House (DEVELOPMENT) opens iframe; keyboard navigation works                                                                                                    | Pending        |
| Shell rendering    | Light House, scaffold version/stage and explicitly unconfigured integrations; no fake metrics                                                                                     | Pending        |
| Real Bridge        | App invokes getStatus and reaches backend-available state                                                                                                                         | Pending        |
| Resolver response  | Inspect response: application metadata version 0.1.0/stage Sprint 0 — engineering foundation, backend available, integrations not-configured, server-generated UUID correlationId | Pending        |
| Logs               | backend.status / success and matching correlation ID, no payload/secret output                                                                                                    | Pending        |
| Runtime errors     | No unexpected console, network, CSP, asset or function errors; check light/dark theme and zoom                                                                                    | Pending        |

The UI treats a fulfilled invocation as availability, so inspect the actual resolver response separately. Save redacted evidence only, never a token-bearing HAR. Record failures and stop promotion if any check fails. No real monitoring or JSM orchestration is implemented yet.

## Development site readiness

Owner confirms an appropriate owner-controlled JSM development site exists and will identify it before deployment. Exact URL, administration rights and installation suitability remain to be independently confirmed; no provisioning is needed or authorised. Registration and environment creation alone do not establish a site.

If absent, after separate owner site-creation authorisation, follow the [official demo-site procedure](https://developer.atlassian.com/platform/forge/provision-a-demo-development-site/): forge site provision requests a site (or returns the existing active demo site). It includes JSM; record ready status and expiry, normally 90 days, and use synthetic records. Do not run that command merely to discover whether a site exists because it can provision one. Explicit --site installation avoids implicit provisioning through --demo-site. If unavailable, use the traditional site setup wizard linked by [getting started](https://developer.atlassian.com/platform/forge/getting-started/). The [Marketplace developer benefit](https://developer.atlassian.com/platform/marketplace/getting-started/) describes a free development instance including one JSM agent; verify current eligibility and terms before selection. Do not assume unlimited agents, permanent entitlement, free production use or that Forge consumption billing is covered. No site or paid plan created here.

## Environment governance

Promotion policy is a Light House proposal, not completed acceptance. Use the same registered app ID and reviewed Git commit through development -> staging -> production, with explicit --environment on commands. Deployments create versions per target environment, not a configuration/data copy. Record build/commit/version mapping; a future immutable Forge build tag can be reused only after authorised upload/inspection, with current CLI compatibility reviewed.

| Environment | Intended use and gate                                                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| development | Active engineering, synthetic inventory, integration verification, developer smoke tests                                                  |
| staging     | Same reviewed release candidate; regression, demonstration rehearsal and security acceptance before promotion                             |
| production  | Hackathon distribution/submission only after competition requirements are verified again, security release gate passes and owner approves |

Runtime variables have separate environment values and require redeployment to take effect. KVS namespaces isolate site/product/environment; SQL provisions a database per installation. Forge isolation does not enforce ISP tenant boundaries inside an installation. Future migrations must record schema readiness/version per installation and environment, run bounded idempotent forward migrations first in development then staging, and verify before enabling new code. Application rollback does not undo SQL or external side effects. No migrations are implemented or run in Sprint 0.6.

Future credentials remain KVS setSecret/getSecret with installation/source/tenant binding, rotation and revocation per environment; SQL stores references only. Provision each environment independently; do not copy secrets/customer data automatically. Use encrypted Forge variables only for approved environment-level configuration and private interactive entry; frontend variables are public. Staging has no tunnel; production debugging follows current console/log-access guidance rather than assuming development CLI access. No values were listed or changed.

Official sources verified 2026-11-26: [environments](https://developer.atlassian.com/platform/forge/environments-and-versions/), [versions](https://developer.atlassian.com/platform/forge/versions/), [KVS partitioning](https://developer.atlassian.com/platform/forge/storage-reference/kvs/), [SQL](https://developer.atlassian.com/platform/forge/storage-reference/sql/), [packaging](https://developer.atlassian.com/platform/forge/manifest-reference/packaging/), [build](https://developer.atlassian.com/platform/forge/cli-reference/build/), [deploy](https://developer.atlassian.com/platform/forge/cli-reference/deploy/), [install](https://developer.atlassian.com/platform/forge/cli-reference/install/). Forge MCP manifest guide and packaging/storage searches also consulted. Live isolation, deployment and artifact acceptance remain unverified.

## Focused final diagnostic acceptance — 2026-11-26

The owner's requested acceptance refinement replaces manually locating a raw Network response with the installed Run health check interface: resolved Bridge invocation, validated backend/metadata/integrations and valid UUIDv4 correlation must succeed. Clear Console, refresh, run the check and review unexpected app/CSP/asset/Bridge errors; provide only sanitised findings, UTC time and correlation ID. Compare actual development backend.status logs separately. No HAR/cookies/tokens requested. This replaces the earlier weaker backend-available indicator; deployment success alone is insufficient.

[Official Jira theme procedure](https://community.atlassian.com/learning/lesson/adjust-your-jira-personal-settings), verified 2026-11-26: profile menu -> Theme -> Light / Dark / Match browser. Existing view.theme.enable and token colours are compatible in simulated jsdom tests; installed behaviour remains unverified. If unavailable, Sprint 5 deferral requires explicit owner approval. No staging/production promotion or security exception transfer.

## Sprint 1 deployment hold — 2026-11-26

The accepted foundation deployment 2.1.0 is preserved. Sprint 1 adds SQL and read:jira-work and requires new major-version installation consent. No Sprint 1 deployment/install/database migration has been executed or authorised by this implementation task. Final explicit-development official lint completed with zero errors/warnings and one MAJOR_VERSION_RULE approval requirement (exit 1). Earlier attempts timed out. No approval override was used; local manifest checks do not resolve this gate. Follow the [Sprint 1 live acceptance procedure](sprint-1-live-acceptance.md) only after explicit authorisation and refreshed dependency-risk disposition. No staging/production command, app registration or additional installation is permitted. See sprint-1-execution-report.md before publication/merge.
