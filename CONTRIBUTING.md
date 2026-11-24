# Contributing to Light House

Read `AGENTS.md`, requirements and the relevant ADR before changing a boundary. Use a short-lived `sprint-N/<description>` branch from the agreed baseline and reference LH task IDs in commits and review descriptions.

Run `npm ci`, make focused changes, then `npm run validate`. Update the lockfile only for intentional dependency changes. Use `npm run format` before committing. Tests must exercise observable behaviour and failure paths; distinguish SDK mocks from installed Forge runtime evidence.

Changes to tenancy, auth, lifecycle or SLA semantics need a design update and negative-case tests in the implementing sprint. Reviewers inspect secret handling, tenant predicates, duplicate/retry safety and request payload minimisation. CI validates PRs and main and never deploys. Record decisions and test evidence in tracking/audit and add a changelog entry. Owner registration and development deployment remain separate gates; production, paid resources and remote pushes require explicit authorisation.
