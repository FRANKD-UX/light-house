# Cost governance

Reviewed 2026-11-26 using the installed forge-cost-optimizer skill, Forge MCP and official documents. Registration terms were accepted by the owner; actual billing/payment/recipient configuration was not accessible or changed here. Development deployment/install are authorised for the minimal smoke test; paid provisioning remains unauthorised. Overall current optimisation opportunity is low: one mount-time backend status check and one allowlisted log, no SQL/KVS, events, schedules or external calls. Keep this invocation for actual backend smoke acceptance. React StrictMode can duplicate development mount effects; count actual invocations rather than assume exactly one per opening. Do not tune memory without platform measurements.

## Current published allowances

The [pricing page](https://developer.atlassian.com/platform/forge/forge-platform-pricing/) describes monthly allowances per app, across all environments. They are not renewed for every installation or development environment. Billing is consolidated for the Developer Space; monitor all its apps. Published USD overage rates at review:

| Capability         | Monthly allowance  | Overage             |
| ------------------ | ------------------ | ------------------- |
| Functions duration | 200,000 GB-seconds | $0.000025/GB-second |
| KVS reads          | 0.1 GB             | $0.055/GB           |
| KVS writes         | 0.1 GB             | $1.090/GB           |
| Log writes         | 1 GB               | $1.005/GB           |
| SQL compute        | 1 hour             | $0.143/hour         |
| SQL requests       | 100,000            | $1.929/million      |
| SQL stored data    | 730 GB-hours       | $0.00076850/GB-hour |

These are dated platform facts, not guarantees of zero cost. Stored SQL accumulates hourly across month boundaries. Async consumers and scheduled functions consume compute/log/storage as used, not a separate free pool. This app has neither; no resources are added for cost estimation. No AI, containers or external backend is proposed.

## Conservative demonstration model

Proposed planning ceiling across all environments: 1,000 function executions/day (30,000/month), budget 1 GB-second each including retry work = 30,000 GB-seconds/month; 500 bytes of application logs each = approximately 15 MB/month. These are estimates and manual operating limits, not platform caps or measured timings. Include platform log overhead and failed/retried work when comparing actual usage. Stop a session if usage behaves unexpectedly. Current scaffold uses no persistence; future demonstration planning target across all installations: <=10,000 SQL requests/month, <=0.25 compute hours/month, <=0.05 GB average stored (36.5 GB-hours in 730 hours), <=0.02 GB KVS reads and writes/month. These proposed targets need measurements and are not implemented instrumentation.

Retain synthetic topology proposal: two ISPs, three sites/six uplinks/six customers each; <=100 fixture deliveries/day, <=5 retries before manual review. Plan budgets across engineering, rehearsals and judges together; do not multiply allowances by site count. Future code must deduplicate before costly work, bound batches/concurrency, pass IDs through queues, schedule only necessary repair/deadline work and retain small allowlisted logs. No polling, schedules, SQL or cost feature is implemented in this sprint. No measured savings claimed.

## Owner console actions before deployment

In the owner-controlled Developer Space, review Settings -> Billing Console: transaction account, payment-method status, subscriptions, invoice/contact details and authorised billing admins. The [billing guide](https://developer.atlassian.com/platform/forge/developer-space/billing-for-developer-spaces/) describes consolidated monthly billing; missing payment methods can lead to enforcement affecting all apps and are not a spending control. Do not add/change payment methods without owner action.

Confirm recipients and monitor the app Usage and costs dashboard, daily during engineering/rehearsals and after demonstrations. [Usage alerts](https://developer.atlassian.com/platform/forge/usage-alerts/) are automatic for contributors/billing admins after space consent, at 50%, 75%, 90% and 100% resource thresholds. Verify receipt in the real console/account; no alert was sent or tested here. These are resource alerts, not a user-selected currency budget or guaranteed cutoff. No configurable hard spending cap was established from reviewed documentation. Owner must inspect actual available controls, choose a manual stop/escalation threshold (proposed: investigate at 25% of any allowance, pause tests at 50%) and decide whether to authorise any potential overage. Do not claim these thresholds are configured.

Use the [official estimator](https://developer.atlassian.com/platform/forge/cost-estimator/) with observed metrics before increasing traffic. Apply [cost optimisation guidance](https://developer.atlassian.com/platform/forge/optimise-forge-costs/) in future implemented sprints without weakening security/retention or moving privileged work into the browser. Owner console verification, usage measurements, budget decision and any paid exposure remain open RK-06 gates. JSM site/licence costs are separate; see deployment.md.

## Dated owner-provided FinOps baseline — 26 November 2026

The project owner inspected Light House Usage and charges: current extra usage charges **USD 0**, forecast **USD 0**, and zero consumption across displayed resources. This is owner-provided console evidence, not an independently queried measurement.

| Resource              | Displayed monthly included allowance |
| --------------------- | ------------------------------------ |
| Function compute      | 200,000 GB-seconds                   |
| SQL compute           | 1 hour                               |
| SQL storage           | 730 GB-hours                         |
| SQL requests          | 100,000                              |
| KVS reads             | 0.1 GB                               |
| KVS writes            | 0.1 GB                               |
| Logs written          | 1 GB                                 |
| Object store requests | 5,000                                |
| Container compute     | 0                                    |
| Container memory      | 0                                    |
| LLM credits           | 0                                    |

The existing Service Collection Standard subscription displayed next estimated charge **USD 0.00** and next billing date **15 December 2026**. This does not establish permanent free product licensing. Included Forge allowances are not hard spending caps. No billing or payment settings were changed.

The acceptance deployment uses only the existing minimal Custom UI/status function and allowlisted log. No SQL/KVS, containers, schedules, LLMs, paid provisioning or real monitoring connections were added. Post-smoke usage and charges must be checked by the owner because this session has no browser/console access. Do not treat the pre-test zero baseline as post-test measured usage.
