# Deployment and installation gates

No deployment, registration, installation link or live integration exists at Sprint 0 handover. Local validation is independent of Atlassian credentials. Do not deploy production, incur paid resources or push remotes without explicit owner authorisation. CI never deploys.

## Owner authentication and registration

```sh
nvm install
nvm use
npm ci
npm install -g @forge/cli@16.0.0
forge login
# Inspect console for an existing registration before the conditional registration step below.
npm run build
forge lint
```

Only if no existing registration is found, `forge register` must create the real owner-controlled app and developer space and add `app.id`; otherwise restore the genuine existing ID. No fabricated ARI is acceptable. Verify displayed permissions and environment. If CLI asks for analytics consent, make that owner preference explicitly; local runs here used isolated configuration with analytics disabled.

## Development deployment — only after owner authorises it

Replace `your-development-site.atlassian.net` with a real JSM development site owned by the reviewer:

```sh
forge deploy --environment development
forge install --environment development --site your-development-site.atlassian.net --product jira
```

Open Jira Apps → Light House, confirm accurate Sprint 0 stage, no connected integrations, and successful real backend resolver invocation. Inspect CSP/network errors, light/dark theme, keyboard/zoom behaviour and redacted Forge logs. Capture app version, site, environment and date in audit without tokens. No runtime acceptance can be marked passed until this happens.

Before future ingestion deployment verify scopes, KVS/SQL consent, migration readiness, secret rotation and billing settings. Adding SQL/scopes may require installation upgrade/consent. Future queues/schedules need crash/retry and cost testing. Record schema versions and use forward-fix migrations; do not promise automated rollback of durable or external side effects.

## Distribution/release

After a separately authorised production release, use the Forge developer console distribution page to enable sharing and obtain the actual installation link. Verify installation in a fresh judge-controlled environment and include setup instructions. Some distribution/licensing states constrain sharing; recheck official documentation. No production command is executed or automated here. Owner must authorise production and any paid exposure first.

Official registration/distribution references and 2026-11-24 verification are in capability assessment. A shareable URL alone is not an exercised judge installation.

## Sprint 0.5 development-only smoke acceptance procedure

Readiness checked 2026-11-25. No deployment authorised or performed. Manifest still lacks app.id; owner registration/site and LH-014 security disposition are prerequisites. A genuine ID is not proven by a syntactically plausible ARI: verify owner-controlled console/app correspondence, then authenticated CLI. Do not replace an ID already present or create a duplicate app. No credentials in chat or tracked files.

Owner setup (local commands; choose registration branch only after console inspection):

```sh
nvm install
nvm use
npm ci
npm run validate
npm install -g @forge/cli@16.0.0
forge --version
forge login
forge whoami
```

Inspect the owner [developer console](https://developer.atlassian.com/console/myapps/) for an existing Light House registration. If registered, restore its genuine app.id into manifest.yml from that console rather than registering again. If and only if none exists:

```sh
forge register
```

Then run `forge lint --non-interactive` and record exit/output. The local manifest wiring script is not this official CLI gate; failed registration validation is not authenticated success. Reassess LH-014 and record owner disposition before deployment. After explicit development deployment/installation authorisation, substitute the authorised real site for the example placeholder:

```sh
npm run build
forge deploy --environment development
forge install --environment development --site your-development-site.atlassian.net --product jira
forge logs --environment development --since 15m --limit 50 --grouped
```

If already installed, inspect installation status and use `forge install --upgrade --environment development --site your-development-site.atlassian.net --product jira` only where an upgrade is required. Do not treat install failure as permission to create resources. No production commands are part of this procedure.

| Acceptance check             | Expected result / evidence to record                                                                                                                                                                            | Current result |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Development deploy           | CLI exit 0; genuine app/environment/version recorded                                                                                                                                                            | Not executed   |
| Authorised Jira site install | CLI exit 0, correct site/product/permissions; no unexpected egress/scopes                                                                                                                                       | Not executed   |
| Global page access           | Jira Apps → Light House opens real iframe                                                                                                                                                                       | Not executed   |
| Shell renders                | Product Light House, scaffold stage, version 0.1.0; no operational metrics/integrations claimed                                                                                                                 | Not executed   |
| Real Bridge invocation       | Existing App calls `invoke('getStatus')`; view reaches backend-success state                                                                                                                                    | Not executed   |
| Expected status contract     | `{application:{name:'Light House',repository:'light-house',version:'0.1.0',stage:'Sprint 0 — engineering foundation'},backend:'available',integrations:'not-configured',correlationId:<server-generated UUID>}` | Not executed   |
| Runtime errors               | Browser console/network: no unexpected CSP/asset/Bridge failures; no backend exceptions                                                                                                                         | Not executed   |
| Logs inspectable             | `backend.status`, outcome success and matching correlation ID in redacted allowlisted log                                                                                                                       | Not executed   |

Inspect the Bridge response in browser devtools if available; do not introduce a fake transport or test-only status endpoint. Save only redacted evidence; no HAR containing session tokens. Match the response correlation ID to `forge logs`; record deployment version/date/site alias and command exits. Check keyboard/zoom and light/dark theme as secondary scaffold acceptance. If any check fails, record failure and retain blocked state, never credit mocked unit tests as runtime evidence.

Official command/module sources verified 2026-11-25: [lint](https://developer.atlassian.com/platform/forge/cli-reference/lint/), [logs](https://developer.atlassian.com/platform/forge/cli-reference/logs/), [global page](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-global-page/). Deploy/install command flags also checked against installed Forge CLI 16 help. The status contract is sourced from this repository, not fabricated operational data.
