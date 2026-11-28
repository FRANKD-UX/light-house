# Reproducible local PoC review

Verified 2026-11-28. This review records local preparation, not deployment authorisation or hosted acceptance.

The frozen source checkpoint is `87ebd25f3f6c9552b648f49bbf072d14acbef053`, preserved on `sprint-3/incident-orchestration` and the isolated local `sprint-4/native-poc-review` worktree. The active `sprint-4/jsm-operational-delivery` branch has subsequent implementation; its changes are outside this frozen review. Existing DEVELOPMENT remains `2b97545fe87e5d3d371ab2982da7e41b7614d834`, major 4. No deployment, upgrade, migration or Jira write was performed.

## Reproduction evidence

The first clean install selected system Node 22.22.1/npm 9.2.0 and stopped with EBADENGINE. Selecting the existing project-compatible Node 22.23.4/npm 10.9.9 through nvm corrected the environment without changing engines or dependencies. Clean npm ci added 339 packages and audited 340. npm run validate passed all 393 tests in 40 files, lint, formatting, strict types, coverage, production builds and local manifest checks. Coverage reproduced 95.07% statements, 93.50% branches, 97.29% functions and 96.29% lines. The same frontend asset `index-BsqaEZsW.js` and 251.4 kB backend bundle were produced. Source stayed clean.

Authenticated read-only `forge lint --environment development --non-interactive` on that checkpoint exited 1 and reported MAJOR_VERSION_RULE. It did not time out or fail credential-store access. The bounded result projection did not establish other error/warning counts. Therefore Forge lint is **not passed**; no `--approve` or verification bypass was supplied. Prior owner approval for deployed Sprint2 does not transfer to the new scopes/artifact. The official [lint command reference](https://developer.atlassian.com/platform/forge/cli-reference/lint/) documents the approval option; checking its existence does not approve a rule.

Dependency/cache findings remain in programme-security-assessment.md. The clean isolated cache reported 12 findings, while current full and production audits report 18, with the same three root advisories. The conservative 18 finding disposition remains required. No package/lockfile changes were made.

## Consolidated external prerequisites

Browser inventory returned browser access host unavailable, with no enabled apps or browsers. No authentication infrastructure or tunnel was restarted. A text-only request asks the owner for current comparable DEVELOPMENT SQL/Functions/KVS consumption, capture/data-through times and delayed-metering allowance; pending jobs/intents/receipt baseline or explicitly unknown; and synthetic JSM project/service-desk/request-type availability. Private URLs, credentials and session state are excluded.

Those facts do not themselves authorise hosted mutations. Reconcile remaining shared 2,000 additional/5,000 cumulative SQL limits and reservations before proposing a bounded session. Historical 286 requests and the proposed 600 reservation are not verified current headroom. The existing Sprint2 acceptance runbook remains the authority for v002/source/URL/terminal preparation. The new scopes and v003–v005 require separate exact-artifact review and applicable deployment/install/native authority. Preserve existing data and all release gates. No approval to bypass lint or native workflow enforcement is inferred.

## Owner preflight update — 2026-11-28

Owner reported Developer Console app-level usage for 2026-11-01–2026-11-28, approximately 09:05 SAST / 07:05 UTC. Exact capture and data-through timestamps remain UNKNOWN; DEVELOPMENT-only filtering is not independently confirmed. Console allows up to one hour delay. Actual displayed consumption: Functions31.0764 GB-seconds; SQL compute0.0061 hours; SQL requests292; SQL storage0 GB-hours; KVS reads/writes0 GB; logs0.0005 GB; object requests0; container/LLM0. Extra usage, current charges and forecasted charges are zero. Included allowances are not the owner-approved test ceiling or guaranteed billing caps. Use these actual values, never estimator URL projections.

This supersedes historical286 as the latest observation, but does not establish comparable DEVELOPMENT headroom, delayed/unmetered bound, or a renewed reservation. All pending async/schema/processing jobs, ingestion receipts/baseline and retry/dead-letter states remain UNKNOWN, not zero. Lantern Fibre admin is the application tenant, not a confirmed JSM project. Synthetic project/name/key, service desk and request type are unknown. Keep exact site/installation details in owner-only private configuration, not public project docs.

Owner explicitly directs continued local implementation and deterministic read-only discovery preparation, with no hosted mutations, migrations, deployment, queue submission or ticket creation until prerequisites and scoped authorisation pass. No extra usage charge is observed; this does not establish no pending work or native readiness. The next discovery bundle must distinguish what the deployed Sprint2 UI can actually expose from new local incident/intent APIs that are not installed.
