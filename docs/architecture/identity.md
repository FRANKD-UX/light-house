# Identity boundaries

Forge/Atlassian authenticates users and provides the application installation context. TenantMembership maps trusted Atlassian accountId to an ISP role. External identity adapters only resolve person/team metadata and proposed assignee mappings; they cannot log users into Light House or grant tenant admin rights.

Keep Entra `(directoryTenantId, objectId)`, Google `(customerId, userId)`, Atlassian accountId and internal assignee ID separate. Email may assist an explicitly reviewed mapping but is mutable and cannot prove identity or grant access. Disabled/deleted directory records disable suggestions and flag existing assignment; do not silently transfer identity to a reused email.

Proposed `DirectoryIdentityAdapter` operations are lookup, bounded sync and explicit mapping validation; the interface is deferred until Sprint 6 to avoid speculative implementation. Use REST only with tenant consent and least read permissions. Forge external OAuth supports user-consented provider access; unattended provider auth, API licensing, admin consent and token refresh are unverified provider-specific gates. Manual mapping with an authorised admin and audit reason must always work when a directory is unavailable. Backend role checks remain required even if a directory group suggests membership.

References: [Forge external OAuth guide](https://developer.atlassian.com/platform/forge/use-an-external-oauth-2.0-api-with-fetch/), verified 2026-11-24. Provider API implementation/permission details remain unverified. Microsoft Graph directory REST could be evaluated for identity lookup only; Microsoft Graph email integration is prohibited.
