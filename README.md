# Light House

Light House gives ISP NOC teams business context for infrastructure incidents through Atlassian Forge and Jira Service Management (JSM). The technical repository name is `light-house`.

**Stage: Sprint 0.6 — tooling stabilised; external acceptance pending.** The React Custom UI shell and read-only status resolver are implemented. Inventory, ingestion, persistence, SLA enforcement, directory adapters and JSM incident creation are designed only. No integrations are connected or deployed. The genuine owner-registered app ID is preserved. Official CLI lint is blocked here by credential-store access; deployment and installed runtime remain pending.

## Local development

Use Node from `.nvmrc` (22.23.4), npm 10.9.9 and Forge CLI 16.0.0, verified in Sprint 0.6.

```sh
npm ci
npm run validate
```

`validate` runs lint, formatting, strict type checking, coverage tests, UI/backend builds and a local manifest wiring check. It does not run authenticated Forge validation. `npm run build` writes `dist/ui` and `dist/backend`; Forge deploy packages `src/index.ts` itself.

The manifest retains the genuine registered `app.id`; do not register again or replace it. Local agent skills/config are ignored development tools, excluded from app validation and builds. See [development setup](docs/operations/development-setup.md) and [deployment gates](docs/operations/deployment.md).

## Architecture and scope

Custom UI → Forge resolver → application use cases → domain contracts. Future adapters connect Zabbix, Forge SQL/KVS, JSM and external directory mappings through application ports. All data is synthetic. No separate backend, AWS dependency, GraphQL, runtime AI, Zendesk or external email service is permitted.

Start with [requirements](docs/project/requirements.md), [architecture](docs/project/architecture.md), [capability assessment](docs/project/forge-capability-assessment.md), [backlog](docs/project/tracking.md), [ADRs](docs/adr/README.md) and [Sprint 0 evidence](docs/project/audit.md). Follow [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Internal release target: **19 December 2026**. Submission deadline: **22 December 2026, 22:00 SAST (20:00 UTC)**. Category: Apps for Specialized Industries. Zoho Desk is a stretch goal.

Sprint 0.5 documents server-authoritative operational workflow, Border Control, accountable handoffs and guarded closure. These are future designs; the running scaffold still reports Sprint 0 metadata. See [gap analysis](docs/project/architecture-gap-analysis.md), [security assessment](docs/project/dependency-security-assessment.md) and [Sprint 0.5 handover](docs/project/sprint-0.5-execution-report.md) and [current Sprint 0.6 handover](docs/project/sprint-0.6-execution-report.md). Eight affected dependency packages remain an explicit deployment/release gate. No Sprint 1 implementation has started.
