# Light House coding instructions

## Scope and boundaries

Use the product name **Light House** in user-facing text and `light-house` for technical identifiers. Build only the assigned sprint. Read `docs/project/tracking.md`, the audit and relevant ADRs before edits; report discrepancies before assuming completion.

All application implementation is TypeScript on Atlassian Forge. Use React Custom UI, Forge Functions/Resolvers and Forge-native persistence. Zabbix is primary; monitoring adapters implement the shared port. Microsoft Entra ID and Google Workspace map identities with manual fallback; they never replace Atlassian authentication. JSM sends native notifications. Zoho Desk is optional. Prohibited: Python backend, Next.js, separately hosted backend, AWS dependencies, GraphQL, runtime LLM/Rovo/generative AI, Zendesk, Microsoft Graph email and external email delivery services.

## Repository conventions

`src/domain` has no Forge imports. `src/application` defines use cases and ports and must not import infrastructure. `src/infrastructure` implements ports. `src/forge` owns trusted runtime boundaries and wiring; `static/app` uses Forge Bridge, never server secrets or backend implementation imports. Keep public metadata/contracts safe to bundle. Tests live under `tests/unit`, `tests/contract`, `tests/integration`; label mocked SDK tests accurately.

Use strict TypeScript, explicit unknown inputs at trust boundaries, narrow result/error contracts, UTC timestamps and internally generated correlation IDs. Prefer small modules and supported APIs over frameworks or general-purpose ORMs. Pin direct dependencies and commit `package-lock.json`; use `npm ci`. Review engines, licenses, audit findings, lockfile and runtime/bundle compatibility for each dependency change. Do not force audit fixes or silently downgrade Forge SDKs.

## Security and tenancy

Never print/read credentials unnecessarily or commit tokens, private keys, `.env` files, employer code, customer data or real infrastructure. Use synthetic fixtures and reserved example domains. KVS `setSecret/getSecret` stores credential material; SQL holds references only. Logs use the allowlisted structured logger and must not receive payloads or arbitrary exception messages.

Forge installation and ISP tenant are different boundaries. Every tenant operation accepts a trusted tenant context, filters by tenant and validates same-tenant referenced records. Use composite unique constraints and parameterised SQL. Never resolve tenant ownership from webhook payloads or client-selected IDs alone. Credential configuration binds installation/source/tenant; resolvers derive Atlassian identity server-side and verify membership and administrative permissions. UI display conditions do not authorise a mutation. Support credential rotation, bounded replay windows and durable duplicate controls.

## Delivery and testing

Use `sprint-N/<description>` branches; Sprint 0 uses `sprint-0/engineering-foundation`. Preserve unrelated work; no reset, force-push, remote push, production deployment or paid resource creation without explicit owner authorisation. Local commits are permitted when requested. Do not fabricate app IDs, runtime test results, integration connections, metrics or implementation status.

Before handover run `npm run validate`, inspect dependency audit and staged files for secrets, and record actual commands/results and limitations in `docs/project/audit.md`. Add meaningful behaviour tests for implemented changes and negative/security cases at trust boundaries. Architecture-only designs do not require pretend implementation tests. Forge CLI lint/deployment/runtime acceptance are separate gates requiring a real app and credentials.

Maintain requirements, affected architecture/integration docs, ADRs, tracking, risks, acceptance criteria and changelog with each meaningful change. ADRs distinguish owner-approved constraints from proposed defaults. Source material architectural claims to official URLs and a verification date; mark unavailable documentation unverified.

## Definition of Done and handover

A task is done when its acceptance criteria are met, applicable checks pass, security/tenant boundaries are reviewed and evidence is recorded. Document blocked gates rather than marking them passed. Every sprint handover records branch/commit, changed files, implemented versus designed functionality, dependency versions, test/build results, outstanding risks/blockers, owner decisions and exact follow-up commands. Update tracking and changelog before concluding. Do not start the next sprint automatically.
