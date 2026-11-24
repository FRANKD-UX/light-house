# Cost governance

No paid resources or deployment are authorised in Sprint 0. Forge is consumption-billed above monthly allowances; the monthly reset does not remove retained SQL data cost. Do not assume a free sandbox prevents billing for a deployed app. Exact current rates/allowances were verified 2026-11-24 at [official pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/) and summarised in capability assessment; recheck before deployment.

Proposed synthetic workload budget: 3 sites, 6 uplinks, 6 customers per ISP, 2 ISPs, at most 100 fixture deliveries/day, one active processing attempt per problem aggregate and at most 5 application retries before manual review. These are initial operational proposals, not configured platform caps. Record actual GB-seconds, SQL requests/compute/storage, KVS read/write and log usage after authorised testing.

Bound due-work scans by tenant/status/next_due_at and page size; schedule only after there is a real repair/deadline use case. Deduplicate before enrichment/Jira creation, send queue IDs instead of payload copies, avoid high-cardinality/raw-payload logs and apply documented retention. Disable compromised/noisy source credentials and preserve enough audit evidence to investigate.

Before deployment the owner must review Developer Space billing/payment settings, choose budget/alert thresholds and recipients, inspect whether available controls actually stop spend or only alert, and authorise any paid exposure. Alert thresholds are not a guarantee of hard spending limits. Do not silently enable billing, create integrations/resources or run bulk fixture floods. Zoho/directory commercial terms remain unverified until their sprints.
