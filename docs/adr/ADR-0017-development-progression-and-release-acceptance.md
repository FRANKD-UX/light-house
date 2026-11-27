# ADR-0017: Development progression and release acceptance

Date: 2026-11-27

Status: Accepted by owner — 2026-11-27. Owner authorises a local Sprint1 checkpoint and isolated local LH-103 implementation. Runtime mutations, deployment, installation, remote publication and merge remain separately gated.

## Context

Sprint 1 implementation, local regressions, hosted deployment and partial native retrieval evidence exist. Additional consenting Atlassian identities are unavailable. Historical procedures coupled every native acceptance item to progression/merge, making missing release evidence a blanket development block. Missing evidence is not proof of a defect, and local tests are not native acceptance.

## Decision

Use separate development progression, development deployment/runtime exercise, integration/merge and release gates. Call Sprint 1 **implementation-complete locally with outstanding release acceptance**, conditional on reproducible validation and the scoped review evidence in the execution report. Do not label Sprint 1 fully accepted, security-certified or release-ready.

Local Sprint 2 implementation can be recommended once trusted boundaries/contracts remain intact, existing meaningful regressions/build pass and no confirmed blocking defect exists. The owner has explicitly authorised local LH-103 Sprint2 scope; each later sprint remains separately assigned. Genuine bypass, tenant leak, injection, lost-write/repair correctness defect or failing prerequisite contract becomes a progression blocker immediately; a missing identity/native test alone does not.

Exact reviewed commits, fresh exact-head CI, human/security review and explicit merge permission gate integration into main. Uncommitted work and old-head CI are not final PR acceptance. Native B.2/second-installation tests become mandatory RELEASE gates rather than blanket local-development or merge prerequisites under this accepted decision. They must remain visible in the PR and acceptance backlog. Reclassification is not acceptance and does not bypass branch protection.

Every new development deployment still requires applicable owner authority, supported Forge lint/package/manifest/scope review, exact-tree dependency disposition and relevant runtime/data/resource prerequisites. Any route, permission, credential, schema or ingress addition is reviewed in its sprint before deployment. Existing development risk acceptance never transfers to another tree, staging, production or public distribution.

B.1 administrator-only functional acceptance can run independently under its separately reviewed bounded authority, fresh usage/pending/receipt/owner prerequisites and original write limits. B.2 remains blocked on consenting identities and supported expiry/access mechanisms; genuine second installation remains separately authorised. No new accounts, fault hooks, diagnostic/tunnel/auth infrastructure or extra deployment is implied.

## Release requirements retained

Before public release/distribution/submission, close native role/expiry/revocation/foreign-user denial and real second-installation isolation, full populated fixture/replay/persistence/pagination/relationship/CAS/duplicate checks, genuine recovery/receipt evidence, migration retry/concurrency and policy history where required, physical schema/integrity, resources, dependency/security disposition and owner licence/publication decisions. A clean probe is not recovery; clean rerun is not failure retry; UI hiding is not server denial. Every unchanged requirement is mapped in the execution report/acceptance backlog.

## Consequences and alternatives

This permits parallel product implementation and release evidence collection without weakening runtime security. A release can remain blocked even while later sprint code progresses. Missing identities may ultimately block release; they are not silently waived because of a deadline. Do not create alternate installations/accounts just to improve a report.

Retaining one blanket gate delays unrelated product work; treating all local tests as final acceptance is rejected. The recommendation preserves meaningful local tests, real native passes and evidence limitations. No application code, persistence model, authentication authority or logging rule changes.

## Evidence and verification

The classification matrix, known defects versus evidence gaps, exact local commands/remote PR evidence, mandatory release backlog and minimal critical path are in docs/project/sprint-1-execution-report.md under Delivery governance reassessment — 2026-11-27. ADR-0004/0008/0012/0016 remain in force for security, idempotency, cost and persistence. This is an owner-approved internal delivery policy, not an Atlassian guarantee.

Official trusted-context and SQL boundary references rechecked 2026-11-27: [app context security](https://developer.atlassian.com/platform/forge/app-context-security/), [SQL operations](https://developer.atlassian.com/platform/forge/storage-reference/sql-api/). Native platform semantics remain separately verified, not inferred from these documents or SQLite tests.
