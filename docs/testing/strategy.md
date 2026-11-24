# Test strategy

Sprint 0 uses Vitest for pure contracts/use cases and a mocked Forge resolver registration test. React Testing Library with jsdom exercises loading, success, rejected invocation and unmount behaviour through a mocked Bridge. Coverage includes implemented backend modules and App; TS-only interfaces have no runtime statements. Browser bootstrapping/main and host theme activation are verified by build now and installed browser acceptance later.

`npm run validate` runs lint, format:check, strict typecheck, coverage thresholds, UI/backend build and local manifest wiring. Thresholds: 90% statements/functions/lines, 85% branches. CI uses npm ci and the same gates on PRs and main; no secrets or deploy step. Tests must fail visibly. Dependency audit is reviewed separately; no blanket suppression or automatic force fix.

Future layers: adapter contract tests with bounded synthetic payloads; SQL integration tests for migrations/concurrency and cross-tenant access; worker failure-injection tests around each durable/external boundary; installed JSM tests for actual request/transition/notification behaviour. Pure SLA tests inject UTC clocks. End-to-end demonstration requires an installed app, genuine JSM issue and labelled monitoring transport.

Mocks prove local logic and wiring only. No runtime integration, API permission, installability, database migration, notification delivery or Forge iframe claim can be inferred from these unit tests. Record exact counts/results and blockers in audit. Use meaningful negative tests; do not create placeholder passing suites for unimplemented features.
