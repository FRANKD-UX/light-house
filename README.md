# Light House

Light House gives ISP NOC teams business context for infrastructure incidents through Atlassian Forge and Jira Service Management (JSM). The technical repository name is `light-house`.

**Stage: Sprint 0 — engineering foundation.** The React Custom UI shell and read-only status resolver are implemented. Inventory, ingestion, persistence, SLA enforcement, directory adapters and JSM incident creation are designed only. No integrations are connected, and the Forge application is not registered or deployed.

## Local development

Use Node from `.nvmrc` (22.23.4) and npm. The supplied system Node 22.22.1 is below the current tooling requirement; use the pinned patch for both local gates and Forge CLI 16.

```sh
npm ci
npm run validate
```

`validate` runs lint, formatting, strict type checking, coverage tests, UI/backend builds and a local manifest wiring check. It does not run authenticated Forge validation. `npm run build` writes `dist/ui` and `dist/backend`; Forge deploy packages `src/index.ts` itself.

The manifest deliberately omits `app.id`: only `forge register` may supply the real ARI. See [development setup](docs/operations/development-setup.md) and [deployment gates](docs/operations/deployment.md).

## Architecture and scope

Custom UI → Forge resolver → application use cases → domain contracts. Future adapters connect Zabbix, Forge SQL/KVS, JSM and external directory mappings through application ports. All data is synthetic. No separate backend, AWS dependency, GraphQL, runtime AI, Zendesk or external email service is permitted.

Start with [requirements](docs/project/requirements.md), [architecture](docs/project/architecture.md), [capability assessment](docs/project/forge-capability-assessment.md), [backlog](docs/project/tracking.md), [ADRs](docs/adr/README.md) and [Sprint 0 evidence](docs/project/audit.md). Follow [AGENTS.md](AGENTS.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

Internal release target: **19 December 2026**. Submission deadline: **22 December 2026, 22:00 SAST (20:00 UTC)**. Category: Apps for Specialized Industries. Zoho Desk is a stretch goal.
