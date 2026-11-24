# Architecture baseline

Light House keeps orchestration in Forge. The Sprint 0 deployed surface is intentionally absent: only an unregistered manifest, React shell and status resolver exist locally. Future work follows the diagrams in `../architecture/system-context.md` and `component-model.md`.

Use Custom UI React/TypeScript in `jira:globalPage` for the internal NOC workspace. Forge Bridge invokes backend resolvers. Use Atlassian design token CSS variables and host theme support; introduce individual Design System components only after compatibility/bundle review. UI Kit is compatible but less suitable for the planned inventory and lifecycle interface. JSM queue pages are a later focused extension, not required for the shell.

Forge SQL is the relational default and KVS secure storage holds credentials. Databases isolate installations, while application predicates isolate ISP tenants within an installation. Async Events move network work off ingress. Durable event state plus retry/reconciliation handles gaps between SQL, queue pushes and Jira writes. Scheduled sweeps are bounded repair/deadline checks, never precise clocks.

No general-purpose ORM is selected. No cross-resource transaction or exactly-once claim is made. JSM request creation, workflow transitions, SLAs and notifications need development-site verification. External identity mappings use provider REST APIs only after consent and do not authorise app access.

Approved constraints and proposed defaults are distinguished in the ADR index. Material Forge conclusions and official verification dates are in `forge-capability-assessment.md`. Sprint 0 acceptance excludes registration, deployment, live UI and runtime integration evidence; those remain tracked gates.
