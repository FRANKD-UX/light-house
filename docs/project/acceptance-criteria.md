# Sprint 0 acceptance

Local foundation acceptance and authenticated platform acceptance are separate. A checked design item means the design exists, not that its future runtime feature exists. Final command/test evidence is in audit.md.

- [x] Empty repository inspected without loss; minimal main baseline and isolated sprint branch established.
- [x] Approved requirements and constraints documented.
- [x] Official Forge/competition capability matrix with URLs, date and unverified boundaries.
- [x] Data model covers ownership, relationships, constraints/indexes, retention and security.
- [x] Context/component/entity and processing/operational state diagrams present.
- [x] Threat model and credential/tenant/backend permission requirements documented.
- [x] Lifecycle ambiguity, duplicates, out-of-order recovery, retries and manual paths designed.
- [x] Deterministic/versioned SLA and native JSM ownership distinguished; 24/7 assumption proposed for owner review.
- [x] Fourteen ADRs distinguish approved constraints from proposed mechanisms.
- [x] Prioritised backlog, critical path, roadmap, synthetic demo and hackathon gates documented.
- [x] Minimal TypeScript shell/status/contracts implemented; no fake metrics or connections.
- [x] Strict TS, ESLint, Prettier, Vitest coverage, lockfile, builds and no-deploy CI configured.
- [x] Final npm run validate passed: lint/format/strict types, 10 tests (0 failed), configured 100% coverage, UI/backend build and local manifest wiring; recorded in audit.
- [x] Secret-safe configuration and explicit blockers documented.
- [ ] Owner registration supplies actual Forge ARI.
- [ ] Authenticated Forge lint/development deployment and real installation verified (LH-013).
- [ ] Actual Jira iframe/Bridge/theme/CSP/runtime acceptance (LH-013).
- [ ] Remote GitHub Actions execution after separately authorised push/remote setup.

Owner decisions: proposed ADR mechanisms, 24/7/start-time/unknown-impact rules, retention/replay/rotation parameters, budget/consent settings and development deployment authorisation. These do not prevent independently executable foundation work. A deployable registered app and production/submission readiness are not claimed by local acceptance.

Dependency security remains a separate open deployment/release gate: LH-014 records 8 affected SDK-tree packages (5 high/3 moderate). This is not represented as a clean dependency audit.

## Sprint 0.5 acceptance — 2026-11-25

Checked items below describe completed local analysis/documentation. External gates stay unchecked; this is not a claim of full sprint/platform completion.

- [x] Independently verified Git baseline/90 files/clean entry tree/no owner changes/no app.id/no remote.
- [x] Owner conceptual operational requirements adopted in ADR-0015 without proprietary access.
- [x] Architecture gap analysis completed and existing architecture/requirements docs reconciled.
- [x] Logical entity/table decisions, revised ERD and Sprint 1 inventory-only persistence requirements documented.
- [x] Explicit Jira/workflow/assignment/resolution authority, three gates, handoff return and continuous SLA documented.
- [x] Threat model, risks, acceptance/test plans and original mandatory integrations updated.
- [x] Full and production dependency findings individually assessed with local bundle evidence; no compatible supported fix currently available.
- [x] Actual official Forge lint executed; blocked registration exit 1 recorded.
- [x] Development-only smoke procedure and exact owner commands prepared, no deployment performed.
- [x] CI workflow reviewed and action pins verified; no remote execution claimed.
- [x] Revised Sprint 1–9 backlog and deadline retained; optional timers/customisation/Zoho outside critical path.
- [ ] Genuine app registration/owner identity verified (manifest lacks app.id).
- [ ] Authenticated official Forge lint passes after registration.
- [ ] LH-014 remediated or explicit owner residual-risk disposition recorded before deployment/release.
- [ ] Authorised development deploy/install/Bridge/runtime/log acceptance passes.
- [ ] Owner-authorised remote/push and successful GitHub Actions evidence recorded.

Local final validate and clean committed-tree evidence are recorded in the Sprint 0.5 execution report and appended audit. No native Jira workflow enforcement or future incident engine tests have run. Sprint 1 requires owner initiation and resolution of its platform/persistence prerequisite gates.

- [x] Clean npm ci and final aggregate npm run validate exit 0; ten scaffold tests pass, 100% configured implemented-code coverage, lint/format/types/build/local manifest checks pass.
- [x] Local Markdown links and diff whitespace checks pass; dependency/manifest/CI/application source unchanged.

Clean committed-tree verification is performed after the local commit and reported with its actual hash in handover; it is not a passing external runtime gate.

## Sprint 0.6 acceptance — 2026-11-26 (supersedes historical registration blockers)

- [x] Owner-registered genuine app ID preserved; owner reports three environments and accepted Developer Space terms.
- [x] Seven installed official skills identified, relevant instructions read, content hashes recorded; Forge and ADS MCP respond.
- [x] Third-party agent tooling globally ignored by application ESLint and explicitly by Prettier; no app rules weakened or fixtures modified.
- [x] TS/tests/coverage/build/manifest/dependency scan boundaries inspected; local source/config stays validated.
- [x] Seven independent local commands pass; aggregate validate and final evidence recorded in execution report.
- [x] Ten existing tests/three files and 100% configured implemented-code coverage preserved; no fabricated runtime tests.
- [x] Official lint executed; exact credential-store blocker recorded instead of passing the gate.
- [x] Official source/security/cost review and dependency risk recommendation complete; both audits remain visibly failing.
- [x] Cost/environment governance, first deployment and private GitHub/PR/CI procedures prepared.
- [ ] Authenticated platform listing and official Forge lint pass in owner terminal.
- [ ] Owner LH-014 disposition/security prerequisites and billing/site confirmation completed.
- [ ] Official artifact, authorised deployment/install and actual Bridge/runtime/log acceptance.
- [ ] Authorised remote setup/push and successful remote CI run.

Local commit and clean-tree verification are reported after commit. Sprint 1 remains unstarted and is not authorised by this checkpoint.
