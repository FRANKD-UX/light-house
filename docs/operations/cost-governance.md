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

## Sprint 1 SQL assessment — 2026-11-26

[Current official pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/), verified 2026-11-26: monthly SQL included allowances are 1 compute hour, 100,000 compute requests and 730 GB-hours stored. These are app allowances, not a spending cap. [SQL limits](https://developer.atlassian.com/platform/forge/limits-sql/) separately cap development storage at 128 MiB, DML at 150 requests/second, DDL at 25 requests/minute and per-install tables at 200. This schema uses fifteen application tables plus the SDK checkpoint table. No billing setting or paid resource was changed.

Expected demonstration: two tenants ×44 inventory records and minimal per-command receipts, with eleven explicitly clicked four-record batches per tenant. The local contract asserts fewer than 1,000 SQL statements for a complete first seed per tenant and fewer than 150 read-only statements for a clean rerun; these are conservative application budgets, not measured Forge compute requests/usage. Initial migration requests include fifteen table DDLs/checkpoints, metadata creation and SDK initialisation/list calls; a normal first attempt is expected below the 25-DDL/minute limit, but retry/rate/concurrency behaviour requires live measurement. Three executions per queued job cap app retries; a further run is explicit.

Lists select at most 51 rows for a 50-row page (UI uses 20), by tenant/primary-key cursor. Unique fixture/reference/reverse indexes avoid installation-wide inventory scans. Lifecycle checks are tenant-indexed and bounded per entity kind. Durable admission adds bounded SQL requests to preserve reference integrity; no extra polling, timer, schedule, cache write or migration runs on ordinary reads. The migration consumer has a 900-second ceiling, not a measured duration; memory tuning requires actual measurements. No numeric savings or guaranteed zero bill is claimed. Collect actual SQL compute/requests/storage and Functions/log usage during authorised acceptance; preserve existing budget/alert constraints without modifying billing.

## Independent Sprint 1 readiness estimate — 2026-11-26

The foundation-only descriptions above are historical; Sprint 1 now adds SQL and one explicit async migration consumer. Independent local simulation measured 663 statements for an ISP's initial 44-row seed, 77 read-only statements for rerun, three per inventory list and nine each for a fresh simple repair probe and repairTenant replay. Eleven UI list refreshes add 33 statements per seed cycle. These are application statements against adapted SQLite, not billed Forge requests or measured compute.

Pinned SQL SDK source predicts 36 SQL calls on a clean initial migration and six on a complete rerun, including checkpoint bookkeeping. Seventeen first-attempt CREATE calls include the repeated metadata table and SDK checkpoint table; SDK list uses executeDDL as well. Rapid retries/reruns can exceed 25 DDL requests/minute. Avoid repeated queue clicks; after throttling wait at least 60 seconds and inspect readiness before a deliberate retry. Three attempts are per event, not a global invocation cap.

Suggested owner-approved acceptance planning limit: 5,000 SQL requests across both logical tenants, normal/rerun seeds, negative/security matrix and bounded recovery. This is 5% of the dated monthly allowance, not a platform spending cap. Compute/storage/duration remain unknown; sensitivity calculations and per-exercise counts are in [readiness review](../project/sprint-1-readiness-review.md). Record actual SQL/Functions/log metrics before and after the session. No polling/migration-on-read/cache write exists; repeated per-save auth/readiness checks preserve security and should not be removed without evidence. Memory tuning and broader query batching await measurement. No paid resources/billing changes were made.

## Acceptance-session baseline — 2026-11-26T10:37:17Z

Owner approved an internal 5,000 SQL-request planning budget for this initial session; it is not platform enforced. Current browser inventory reports the access host unavailable; no connected Forge usage API is available. Fresh charges/forecast, SQL requests/compute/storage and function compute cannot be independently read. Owner has been asked for timestamped readings before live SQL exercises. Historical zero readings above are not the new baseline. No application-controlled SQL statement or migration has been initiated in this session at this checkpoint (platform provisioning/internal work is not measured). No billing settings, limits or paid features changed. Official pricing/SQL limits rechecked 2026-11-26; allowances above remain published allowances, not measured remaining capacity.

## Fresh owner-provided pre-SQL baseline

At 2026-11-26T10:40:37Z the owner read Usage and charges for 1–26 November: current/forecast charges USD 0.00; SQL requests 0/100,000; SQL compute 0/1 hour; SQL storage 0/730 GB-hours; function compute 2.548/200,000 GB-seconds. This is owner-provided console evidence. Deployment had started before this timestamp, so it is a pre-SQL baseline, not an independently observed pre-deployment reading. No live application SQL exercise had been initiated by this agent. No paid feature/limit/billing change.

## Native baseline usage and proposed Phase B bound — 2026-11-27

Current actual development usage/charges are unavailable: browser host inaccessible; no hosted usage connector found. Preserve the dated 2026-11-26T10:40:37Z pre-SQL reading above without treating it as current. Seven exact-window successful list paths imply 21 source-model SQL calls; overview normally adds two reads/one permission API request. These are estimates, not aggregate metering or a post-session delta.

[Phase B allocation](sprint-1-live-acceptance.md#phase-b-bounded-authorisation-request--2026-11-27) proposes up to 2,000 incremental SQL calls within the existing 5,000 cumulative acceptance ceiling, including seed/replay, readbacks, seventeen maximum pagination sites, security/recovery/policy/rerun work and reserves. No writes before fresh usage/intents/receipts baseline and approval; do not reset earlier consumption. Stop on unmeasurable bound, unexpected usage/charges/throttling. Exact approved target/identities, unsupported tests and operation caps are in the runbook. Official SQL/usage monitoring docs rechecked 2026-11-27 in investigation; no new pricing claim, paid exposure or changed billing control.

## Approved Phase B accounting clarification — 2026-11-27

Owner approves at most2,000 additional requests within existing cumulative5,000, conditional on fresh usage/state/identities/headroom. Actual current usage remains inaccessible; no new runtime operation performed. Three eleven-kind snapshots require33 explicit lists; reserve60 total at180 SQL calls (formerly25/75) and reduce uncertainty289→184, unchanged2,000 total. These are application planning counts, not measurements or Atlassian caps. Global preflight must verify C+2,000≤5,000 and include read-only/in-flight work before any mutation. Detailed executable prompt is in live acceptance runbook.

## Authenticated Phase B prerequisite checkpoint — 2026-11-27 (current)

Owner approved Phase B conditionally; all mutations held because applicable V/O test identities and consent remain unverified (owner unsure). Authenticated Console now accessible: existing DEVELOPMENT 3.3.0 Latest confirmed; fresh displayed SQL requests 286, SQL compute 0.006 hours/storage 0 GB-hours, Functions 30.2469 GB-seconds/logs 0.0005 GB; current/forecast $0, November 1–27. Up-to-one-hour usage lag means 286+2,000<=5,000 is conditional planning arithmetic, not a verified remaining bound. Lantern tenant v2 pending null; existing repair probe v1 pending null and one matching receipt among five visible receipts. Partial samples do not prove exhaustive clean state/receipt uniqueness. Recovery fault path NOT EXERCISED; all Phase B functional exercises BLOCKED / NOT RUN. No mutation/deploy/tunnel/production/new installation/publication/merge/Sprint 2. Prior native baseline preserved. Full evidence, UTC observations, limitations and browser instructions are in the latest live-acceptance checkpoint and execution report. Consent must be explicitly supplied through private identity mapping; no account creation is inferred.

## Independent-stream SQL reconciliation — 2026-11-27 (proposed)

Recorded Used286 (13:08:31.021Z; Development13:08:56.760Z) gives nominal4,714 cumulative headroom and2,286 after full2,000 additional allowance. Up-to-one-hour lag means a justified unmetered prior U must satisfy U≤2,714; this threshold is not a bound on actual U or an enlarged test allowance. Conflicting estimator318 is not Used and32 is not maximum missing activity. No new reading obtained in this review.

Reserve B.1 1,750 and B.2 250 from ONE shared2,000 allocation; both still cumulative5,000. Serial streams/one ledger/no automatic transfer; retain write caps and60 explicit lists (50/10), with automatic refreshes in write allocations. Conservative equation M+U+P+R≤5,000 counts metered cumulative total, justified prior-unmetered upper bound, Phase B work not included in M, remaining reservations exactly once. Include preflight/failed/in-flight/other app work. Unknown coverage blocks mutation; use complete ledger/data-through or a documented no-invocation/no-job interval spanning observed maximum lag followed by demonstrably advanced coverage. Neither stable count/time elapsed nor arbitrary fixed buffer proves safety. No memory/cache/auth reduction, billing change or exact savings claim. Detailed assessment/prompts in live runbook. Revised workstream gate approval required before writes.
