# Troubleshooting

| Symptom                                   | Action                                                                                                                                                                       |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| npm EROFS cache                           | Use `npm --cache /tmp/light-house-npm-cache ci`; do not change home permissions.                                                                                             |
| EBADENGINE                                | `nvm install && nvm use` with `.nvmrc`. Forge CLI and jsdom may need newer patch versions than the original host Node.                                                       |
| Dependency download timeout               | Retry deterministic install with the same lockfile/cache; do not force versions or disable TLS.                                                                              |
| Forge cannot write config/data            | In a restricted environment set `XDG_CONFIG_HOME=/tmp/light-house-forge-config` and `XDG_DATA_HOME=/tmp/light-house-forge-data`; this is isolated unauthenticated CLI state. |
| Forge says missing app ID                 | Run owner login/register; missing identity is intentional until real registration. Do not insert an example ARI.                                                             |
| UI assets missing                         | `npm run build`; resources reference `dist/ui`, Vite base must remain relative.                                                                                              |
| Standalone shell says backend unavailable | Expected outside Forge Bridge. Installed Jira runtime is a separate test, not a local preview guarantee.                                                                     |
| Formatter/lint/typecheck failure          | Run `npm run format`, repair real violations, rerun affected gate then validate. Never hide failures with continue-on-error.                                                 |
| Unknown future source/site                | Map only within trusted tenant; reviewed replay, no silent zero-impact incident.                                                                                             |
| Ambiguous future Jira create              | Hold retry and reconcile marker; search zero matches is insufficient after timeout.                                                                                          |
| Future notification missing               | Verify JSM recipients, schemes/preferences, comment visibility, rule execution and notification logs. Do not add an external email workaround.                               |

Use generated correlation IDs and safe error codes for support. Never paste raw tokens, webhook payloads or customer data into logs/issues.
