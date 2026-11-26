# Test strategy

Sprint 0 uses Vitest for pure contracts/use cases and a mocked Forge resolver registration test. React Testing Library with jsdom exercises loading, success, rejected invocation and unmount behaviour through a mocked Bridge. Coverage includes implemented backend modules and App; TS-only interfaces have no runtime statements. Browser bootstrapping/main and host theme activation are verified by build now and installed browser acceptance later.

`npm run validate` runs lint, format:check, strict typecheck, coverage thresholds, UI/backend build and local manifest wiring. Thresholds: 90% statements/functions/lines, 85% branches. CI uses npm ci and the same gates on PRs and main; no secrets or deploy step. Tests must fail visibly. Dependency audit is reviewed separately; no blanket suppression or automatic force fix.

Future layers: adapter contract tests with bounded synthetic payloads; SQL integration tests for migrations/concurrency and cross-tenant access; worker failure-injection tests around each durable/external boundary; installed JSM tests for actual request/transition/notification behaviour. Pure SLA tests inject UTC clocks. End-to-end demonstration requires an installed app, genuine JSM issue and labelled monitoring transport.

Mocks prove local logic and wiring only. No runtime integration, API permission, installability, database migration, notification delivery or Forge iframe claim can be inferred from these unit tests. Record exact counts/results and blockers in audit. Use meaningful negative tests; do not create placeholder passing suites for unimplemented features.

## Sprint 0.5 verification boundary

Documentation-only architecture changes introduce no pretend behaviour tests. Re-run existing meaningful scaffold tests and builds after clean install. Dependency review includes full/prod audits and local emitted-module/backend graph evidence; actual Forge artifact/runtime remain separate. Development-only scaffold smoke procedure is in operations/deployment.md. Future workflow regression below is planned, not passing evidence.

## Focused runtime-contract regression — 2026-11-26

35 tests in four files pass. Mock Bridge cases cover valid metadata, every metadata field mismatch, invalid backend/integration values, missing fields, non-object responses, invalid UUID version/variant/type, rejected/synchronously thrown invocations, retry after every malformed case, clearing previous success, overlap prevention and unmount. Extra response fields are not displayed. Coverage includes the new status-contract.ts validator: statements 48/49 (97.95%), branches 60/61 (98.36%), functions 15/15 (100%), lines 46/46 (100%); the uncovered defensive in-flight guard is retained.

Three theme tests check computed styles with synthetic light/dark token palettes in jsdom, all colour declarations using tokens (including focus) and existing host API wiring. These do not render pixels, validate host token injection or establish installed Jira visual/accessibility acceptance. No coverage threshold was lowered. Real installed diagnostics/Console/log evidence is separate.
