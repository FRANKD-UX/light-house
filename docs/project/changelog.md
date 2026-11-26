# Changelog

## 0.1.0 — 2026-11-24 — Sprint 0 foundation

- Established minimal main baseline and isolated engineering-foundation branch in the empty repository.
- Added owner requirements, dated official Forge/competition capability assessment, architecture/data/lifecycle/security/SLA/identity designs, 14 ADRs, roadmap/backlog and synthetic demonstration plan.
- Implemented React 18 Custom UI development shell, read-only Forge status resolver, immutable metadata, shared error/result and tenant/monitoring contracts, correlation IDs and allowlisted structured logging.
- Added strict TypeScript, ESLint, Prettier, Vitest/jsdom coverage tests, exact dependencies/lockfile, relative-resource Vite build and backend compilation smoke check.
- Added least-privilege GitHub Actions validation on PR/main with current official action SHAs and no deployment.
- Local unit/type/lint/build checks passed; final aggregate evidence is in audit. Real registration, Forge CLI validation and installed runtime remain LH-013. No app ARI was fabricated.
- Recorded 8 affected dependency packages (5 high/3 moderate) in current Forge SDK tree as LH-014 before release; no unsafe force fix or SDK downgrade.

No Sprint 1 persistence, live Zabbix ingestion, SLA engine, Jira incident orchestration, provider connection, deployment or remote push is included.

## Unreleased — 2026-11-25 — Sprint 0.5 stabilisation

- Independently verified clean `315200a`/90-file baseline on the existing Sprint 0 branch; no owner changes or app.id found, no remote.
- Added ADR-0015 adopting only the owner-supplied Boomerang conceptual workflow; documented fixed server-authoritative workflow, three gates, accountable handoffs/return, direct NOC path, continuous SLA and explicit Jira ownership/native closure enforcement gate.
- Added requirement-by-requirement gap analysis, entity persistence decisions and ERD extension; updated threat model, requirements, tests planned for later sprints, roadmap/backlog and demo design. No incident engine, schema or frontend feature implemented.
- Individually assessed eight affected SDK-tree packages and three advisories. Current emitted UI/local backend graphs exclude vulnerable leaves; supported parent versions still pin affected dependencies. No dependency changes, overrides, force fixes or downgrade. LH-014 remains open.
- Repeated clean install/local validation and official Forge lint attempt; registration failure remains blocked. Added exact development smoke/remote CI owner procedures; no deployment, push or remote creation.
- Current results, command exit codes, blockers and acceptance checklist are in audit.md and sprint-0.5-execution-report.md; external gates are not marked passed.

## Unreleased — 2026-11-26 — Sprint 0.6 platform acceptance and tooling

- Preserved genuine owner-registered app identity on the existing Sprint 0 branch; removed stale unregistered-manifest comment.
- Added ESLint global ignores for external agent tooling and generated security artifacts; explicit Prettier/artifact Git policy, application rules and lockfile unchanged.
- Verified Node/npm/Forge CLI, seven installed official skills, Forge/ADS MCP and GitHub authentication; documented Codex-specific Forge credential-store blocker without disputing owner login.
- Independently passed local lint/format/types/tests/coverage/build/manifest gates; ten tests and configured 100% coverage retained. Official security scanners completed, no confirmed application finding; eight dependency findings remain open.
- Updated risk disposition proposal, cost/environment governance, authorised-development smoke procedure, private GitHub/PR/CI checklist and Sprint 0.6 evidence. No deployment, site creation/install, paid resource, remote mutation or Sprint 1 work.

## Final foundation Gates B/C — 2026-11-26

- Preserved real Forge registration; supported elevated authentication resolved the sandbox credential-store blocker. Official lint passed, development deployment 2.0.0 and authorised Jira installation succeeded.
- Fixed the actual Forge TypeScript bundling failure: root config permits emit to ignored dist/typescript; local typecheck remains tsc --noEmit. No runtime feature or dependency change.
- Recorded project-owner LH-014 residual risk acceptance for isolated synthetic development only; eight affected packages remain, production security blocked.
- Inspected the saved official backend artifact and reran local gates and deterministic scanners; recorded scope limits separately from actual runtime acceptance.
- Prepared public README/security/contribution/operations documentation and dated owner FinOps baseline. Publication review found historical personal author metadata and a workspace path; owner stopped publication and declined history rewriting. No remote, push, PR, CI run or merge occurred.
- Installed runtime and post-test usage require owner browser evidence. No new foundation sprint or Sprint 1 work.

- Excluded generated .forge inspection artifacts from ESLint/Prettier after final validation exposed generated-code errors; retained all application checks.

## Owner-authorised privacy cleanup and publication continuation — 2026-11-26

The temporary publication hold is superseded by explicit owner approval to correct unpublished author/committer emails and equivalent documentation-only privacy details. Private recovery bundle, original refs, complete old/new commit mapping and redaction record are retained outside the repository. All application/configuration trees, commit messages/names/timestamps and branch relationships are verified unchanged except approved documentation privacy/hash-reference corrections. Both branches are consistent; intended metadata has no Gmail address. Repeated history/current-source review passes. Public repo/push/PR/CI are authorised to continue; runtime/CI remain mandatory before conditional merge. No force push, backup publication or next sprint.

Public GitHub execution: https://github.com/FRANKD-UX/light-house is PUBLIC; cleaned main and foundation pushed; PR #1 created. Free secret scanning/push protection/Dependabot alerts/private reporting and main checks configured. Remote CI result must be recorded after actual completion; merge remains conditional on runtime acceptance. No next sprint.

Remote CI passed for acceptance commit 85f542c: [Validate run 45775501033](https://github.com/FRANKD-UX/light-house/actions/runs/45775501033). PR #1 remains open; remaining runtime response/frontend-error/theme verification prevents merge. Main is the cleaned baseline ff2939c; post-merge CI has not run. The evidence-only documentation update is verified again on its own head before handover.

- Corrected current tracking/acceptance rows after actual publication/CI. Owner cannot locate runtime response or host theme option; response/frontend-error/theme checks remain unverified and PR stays open. No diagnostic functionality or next sprint added.
