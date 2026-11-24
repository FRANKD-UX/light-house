# Product requirements — baseline 2026-11-24

Owner-approved scope: Light House, an ISP incident orchestration app on Atlassian Forge and JSM, for NOC engineers/managers, infrastructure engineers and support teams. Codegeist 2026 category is Apps for Specialized Industries. Release target 19 December; submission 22 December 2026 22:00 SAST.

## Functional contract

1. Receive a Zabbix webhook through a Forge webtrigger and authenticate it before processing.
2. Select a monitoring adapter, validate runtime payloads and normalise stable event/resource identities.
3. Resolve trusted ISP tenant, site and uplink mapping; enrich with carrier, team/assignee and distinct affected-customer counts.
4. Select an effective ISP priority/SLA policy; persist its immutable version, UTC deadline and warning snapshot.
5. Create an actual structured JSM incident/request and durable issue mapping; expose processing and operational states.
6. Suppress duplicate deliveries, reconcile ambiguous writes, process recovery/manual resolution/reopening and handle retry exhaustion.
7. Use native JSM notifications; directory mappings support Entra ID, Google Workspace and manual fallback. Zoho Desk follow-up after resolution is optional.

A webhook forwarding wrapper is insufficient. Business context, impact uncertainty and deterministic policy decisions are core requirements. Duplicate suppression does not imply topology-aware incident correlation.

## Nonfunctional constraints

TypeScript only, Forge Custom UI/Functions/Resolvers, REST and webhooks, no separately hosted backend. No Python backend, Next.js, AWS dependencies, GraphQL, runtime AI/LLM/Rovo, Zendesk or Microsoft Graph email. Minimise billing, dependencies and externally hosted services. All demonstrations use synthetic data; no employer assets or confidential information. Atlassian app authentication remains authoritative. All relevant writes/reads enforce installation plus ISP isolation and least privilege.

## Sprint 0 boundary

Implement shell, metadata, errors, logging, correlation IDs, tenant/adapter contracts and read-only status resolver with tests and local gates. Design inventory, persistence, ingestion, orchestration, SLA and integrations without implementing them. Register/deploy only after owner authentication and separately authorised deployment. See acceptance criteria and tracking for evidence.

## Minimum viable submission

Installable Forge app with synthetic inventory, authenticated Zabbix-compatible fixture ingestion, enrichment, unique customer impact, versioned P1/P2/P3 policies, real JSM issue creation, dashboard visibility, duplicate safety and recovery. Manual identity fallback is essential; Entra/Google adapters remain planned Sprint 6 deliverables and are schedule risks. Optional production enhancements include advanced topology correlation, large directory sync, high-volume tuning and Zoho Desk. No optional feature blocks submission.
