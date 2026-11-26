# Microsoft Entra ID — planned Sprint 6

Map directory tenant ID plus immutable object ID to internal assignee/team records and an independently verified Atlassian accountId. A directory identity is not an ISP tenant, customer or Atlassian login. Do not use email as a durable primary key or grant app roles from unreviewed provider groups.

Provider-specific REST integration is **unverified** in Sprint 0. Before implementation verify tenant admin consent, minimum directory read permissions, token refresh and an authorised app-only versus delegated flow, account licensing, pagination/rate limits and allowed egress domains against official provider docs. Forge's external OAuth guide confirms user-consented REST capability but does not prove this provider's unattended sync model. No external backend, cloud resources or email notification integration is authorised.

On timeout/revocation retain last verified mapping with freshness status and require manual confirmation for risky reassignment. Support manual mapping/unmapping with reason and audit actor. Disabled subjects must not be reassigned by matching a recycled address. Store credentials only in Forge secure storage and expose safe connection state, never tokens.

Acceptance: admin consent/revocation, two-directory isolation, mapping ambiguity, disabled user, rate limit and manual fallback tests. No provider app is registered or connected. See [identity architecture](../architecture/identity.md) and LH-107.
