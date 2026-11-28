# Development MAJOR_VERSION_RULE investigation

Verified 2026-11-28 against published source `1d81253e31178f24eedd1e74fdd6a538452ad9f7`. Read-only investigation; no permission edit, rule approval, deployment or installation performed. Genuine app identity preserved.

## Finding

Authenticated Forge CLI16.0.0 command `forge lint --environment development --non-interactive` exits 1 with **0 errors, 0 warnings, 1 approval**. Diagnostic cause: **Change due to scope modification** in the default environment. It is not a malformed manifest or evidence that being on major 4 is itself an error. Installed official local manifest validation and local resource/handler wiring pass independently.

`forge version details --environment development --major-version 4 --json --non-interactive` exits 0 and returns environmentType DEVELOPMENT, appVersion4 and scopes read:jira-work/storage:app. `forge deploy list --json --non-interactive` exits 0; latest success remains2026-11-27T18:22:04.454Z, environmentKey default, major 4. `forge install list --environment development --json` exits 0; one existing installation is major 4Latest/Up-to-date and the approved site matches privately. The CLI's default label is the observed DEVELOPMENT environment, not an inferred production target. Source2b97545 manifest independently matches those two deployed scopes; deployment metadata alone is not a source-hash attestation.

| Scope                     | Hosted major 4 | Reviewed local manifest | Purpose                                                                            |
| ------------------------- | -------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| read:jira-work            | Present        | Present                 | Issue/project visibility and bounded marker search                                 |
| storage:app               | Present        | Present                 | Forge-native persistence/credential references                                     |
| read:servicedesk-request  | Absent         | Added                   | Service desk/type/field/request readback                                           |
| write:servicedesk-request | Absent         | Added                   | Native customer-request creation                                                   |
| write:jira-work           | Absent         | Added                   | Separate Jira platform transition component; still unregistered for native closure |

This exact three-scope addition explains the reported scope-modification approval gate. The new static issue-context module is not identified by this diagnostic as its cause. No dynamic webtrigger, egress, provider, runtime or app-identity change is needed to address it. Scope necessity is distinct from scope-change classification: the write:jira-work declaration should be reviewed explicitly for the exact POC because transition persistence/confirmation remains unregistered; removing it would change the approved artifact and still leave a scope-change major upgrade.

## Supported minimum remediation — approval required

Retain current identity and existing installation. Obtain an explicit owner decision on the exact manifest scope set/new-major acknowledgement and residual DEVELOPMENT dependency risk, then execute an approved lint with `--approve MAJOR_VERSION_RULE` (no deploy) to verify remaining platform checks. Only after separately scoped deployment approval use supported `forge deploy --environment development --non-interactive --approve MAJOR_VERSION_RULE --inspect`. Approval acknowledges the major-version change; it does not waive other checks. Do not use --no-verify, alter production or auto-confirm unrelated terms/scopes.

A successful deployment may introduce a new major; its actual number must be read back, never pre-claimed. The current installation is up-to-date for major 4 only. An approved existing-installation `forge install --upgrade` with the exact confirmed target and explicit scope consent is a separate operation. No bulk upgrade, new installation or production is implied. Read back version/permissions/health/resource delivery after any authorised change.

| Gate                          | Current status                                                                          |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| Local manifest/build validity | Passed for published 1d81253; no authenticated-platform implication                     |
| Authenticated lint            | Blocked on explicit major-change approval;0 other errors/warnings in this invocation    |
| Deployment eligibility        | Not approved/executed; further preflight/risk/budget/artifact checks mandatory          |
| Installation upgrade          | Not executed; required if accepted deployment creates the new major                     |
| App/service-desk permissions  | Not established by OAuth scopes; target metadata and app/user access remain independent |
| Hosted runtime/context/themes | Unaccepted for the new artifact                                                         |

Official evidence rechecked2026-11-28: [app version rules](https://developer.atlassian.com/platform/forge/versions/), [lint approval flag](https://developer.atlassian.com/platform/forge/cli-reference/lint/), [deploy approval/inspect](https://developer.atlassian.com/platform/forge/cli-reference/deploy/), [version details](https://developer.atlassian.com/platform/forge/cli-reference/version-details/), [installation upgrade](https://developer.atlassian.com/platform/forge/cli-reference/install/). Forge MCP search succeeded and identified exact major-version documentation; exact official pages were reopened. These establish supported procedures, not authority to execute them.
