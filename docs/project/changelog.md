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
