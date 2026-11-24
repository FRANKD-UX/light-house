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
