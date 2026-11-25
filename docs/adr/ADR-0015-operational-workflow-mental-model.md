# ADR-0015: Operational workflow mental model

Date: 2026-11-25

Status: Accepted — owner-approved conceptual requirements; implementation details below proposed

## Context and provenance

Sprint 0 emphasised ingestion/enrichment. The owner now requires the conceptual operational workflow of Boomerang, adapted to ISP incidents. The sole reference is the owner's Sprint 0.5 brief. No Boomerang product internals, proprietary schemas, branding, employer code or infrastructure were consulted or copied. This ADR makes no claims about Boomerang implementation.

## Accepted requirements

Light House owns server-authoritative network workflow, explicit ownership, guarded transitions, three distinct Border Control gates, departmental handoff acceptance/rejection/return, restoration validation, guarded closure, continuous incident SLA and audit history. Direct NOC resolution is supported. Zabbix recovery is evidence, not closure authority. JSM remains the ticketing workspace and native notification authority; Entra, Google and manual identity mapping remain mandatory. Zoho is optional. No generic workflow designer or BPMN engine.

## Proposed implementation defaults

Use a versioned code-defined state machine, bounded validation snapshots and one active handoff reference on the incident. Persist handoff lifecycle records; reuse audit events for assignment/SLA events and incident snapshots for SLA instances. Detailed fields, ERD and sprint placement are in data-model.md; lifecycle and ownership matrix are in event-lifecycle.md. These mechanisms are proposed, not additional owner-approved features or implemented code.

Do not treat a Jira status mirror as the Light House state machine. Native Jira close/resolve paths must be configured and tested so they cannot bypass operational guards. Until site enforcement is proven, guarded closure is a blocked acceptance gate, not a UI promise. No preview Forge workflow validator is assumed to solve this automatically.

## Consequences and alternatives

More operational context is required than a webhook-to-ticket forwarder. Preserve a small fixed MVP workflow; advanced customisation and additional SLA timers are deferred. Team changes never reset the incident deadline. Jira comments, attachments, queues, users and notifications are reused rather than rebuilt. A general-purpose engine, recovery-triggered automatic closure and client-authoritative stages are rejected.

## Verification and owner decisions

Sprints 3/4 test every legal/illegal transition, conflicting versions, handoff races, rejected/returned work, direct NOC resolution, incomplete inventory and recovery without closure. Sprint 7 verifies native Jira bypass attempts and reconciliation. Owner reviews proposed SQL representation, gate checklist contents, team/engineer assignment policy, 24/7 timing, reopen rules and target JSM workflow restrictions. Acceptance of the conceptual model does not approve these defaults.

## References

Owner Sprint 0.5 brief (2026-11-25); [Jira global page](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-global-page/) and [issue context](https://developer.atlassian.com/platform/forge/manifest-reference/modules/jira-issue-context/), verified 2026-11-25 for UI capabilities only. No external source is used to assert proprietary architectural details.
