# Deployment and installation gates

No deployment, registration, installation link or live integration exists at Sprint 0 handover. Local validation is independent of Atlassian credentials. Do not deploy production, incur paid resources or push remotes without explicit owner authorisation. CI never deploys.

## Owner authentication and registration

```sh
nvm install
nvm use
npm ci
npm install -g @forge/cli@16.0.0
forge login
forge register
npm run build
forge lint
```

`forge register` must create/select the real owner-controlled app and developer space and add `app.id`; no fabricated ARI is acceptable. Verify displayed permissions and environment. If CLI asks for analytics consent, make that owner preference explicitly; local runs here used isolated configuration with analytics disabled.

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
