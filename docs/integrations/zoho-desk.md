# Zoho Desk — stretch goal LH-190

Optional post-resolution customer-support follow-up. It must never block Jira creation, resolution, hackathon submission or native JSM notifications. No Zendesk integration is permitted.

Proposed intent key: tenant + incident + resolution cycle. Persist completion separately from the incident; retry ambiguous provider outcomes through reconciliation before creating duplicates. Send only synthetic aliases/aggregate impact and approved incident summary. Authentication, regional API domains, least-privilege scopes, cost and endpoint idempotency are unverified and require current official Zoho documentation before implementation. Credentials remain KVS secrets and egress requires explicit domains. No dependency or connection exists in Sprint 0.
