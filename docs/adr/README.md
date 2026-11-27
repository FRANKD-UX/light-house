# Architecture decision records

All records created 2026-11-24. Accepted constraints come from the Sprint 0 owner brief; proposed mechanisms require review and later runtime verification. No ADR implies deployment or implementation beyond the stated scaffold.

- [ADR-0001: Atlassian Forge as the application platform](ADR-0001-atlassian-forge-as-the-application-platform.md) — Accepted — owner-approved constraint.
- [ADR-0002: TypeScript-only implementation](ADR-0002-typescript-only-implementation.md) — Accepted — owner-approved constraint.
- [ADR-0003: Forge-native persistence](ADR-0003-forge-native-persistence.md) — Proposed — implementation default pending owner review.
- [ADR-0004: Installation and ISP tenant isolation](ADR-0004-installation-and-isp-tenant-isolation.md) — Proposed — logical isolation design; isolation requirement owner-approved.
- [ADR-0005: Monitoring adapter architecture](ADR-0005-monitoring-adapter-architecture.md) — Accepted — extensibility and Zabbix priority owner-approved; contract implemented.
- [ADR-0006: Webhook authentication](ADR-0006-webhook-authentication.md) — Proposed — auth requirement owner-approved; mechanism pending owner review.
- [ADR-0007: Asynchronous incident processing](ADR-0007-asynchronous-incident-processing.md) — Proposed — implementation default pending owner review.
- [ADR-0008: Idempotency and failure reconciliation](ADR-0008-idempotency-and-failure-reconciliation.md) — Proposed — reliability design pending owner review.
- [ADR-0009: SLA ownership and native JSM interoperability](ADR-0009-sla-ownership-and-native-jsm-interoperability.md) — Proposed — 24/7 assumption explicitly requires owner review.
- [ADR-0010: External identity mapping](ADR-0010-external-identity-mapping.md) — Accepted — providers/manual fallback and Atlassian authority owner-approved; provider flows proposed.
- [ADR-0011: Native JSM notification strategy](ADR-0011-native-jsm-notification-strategy.md) — Accepted — owner-approved constraint; configuration pending.
- [ADR-0012: Cost governance](ADR-0012-cost-governance.md) — Accepted — minimise infrastructure/billing owner-approved; controls proposed.
- [ADR-0013: Forge UI architecture](ADR-0013-forge-ui-architecture.md) — Proposed — selected scaffold default pending installed-runtime verification.
- [ADR-0014: Synthetic demonstration data](ADR-0014-synthetic-demonstration-data.md) — Accepted — owner-approved constraint.

- [ADR-0015: Operational workflow mental model](ADR-0015-operational-workflow-mental-model.md) — Accepted conceptual requirements; proposed persistence/state mapping and site enforcement pending verification.

Sprint 1: [ADR-0016 — physical persistence and bounded repair](ADR-0016-sprint-1-persistence-and-repair.md).

- [ADR-0017: Development progression and release acceptance](ADR-0017-development-progression-and-release-acceptance.md) — Accepted by owner 2026-11-27; local Sprint2 development authorised, release gates retained.
- [ADR-0018: Local monitoring intake](ADR-0018-local-monitoring-intake.md) — Implemented local defaults; deployment/risk/native integration acceptance outstanding.
