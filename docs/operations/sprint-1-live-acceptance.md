# Sprint 1 development SQL acceptance procedure

Status: prepared, not executed. This procedure does not authorise deployment, installation upgrade, migration, publication or merge. Use the existing registered app and owner-confirmed development installation only. Never run these commands against staging/production or create another app/site.

## Preconditions and commands

Owner must explicitly authorise the Sprint 1 development deployment and SQL/permission consent upgrade, review the changed LH-014 exposure and confirm existing cost constraints. Official lint must pass. Preserve application registration/Developer Space. Set LIGHT_HOUSE_DEV_SITE privately to the existing authorised site; do not commit its value or credentials. Use the existing secure CLI login; never paste credentials in chat.

```sh
nvm use
npm ci
npm run validate
npm exec vitest run tests/integration/inventory-service.test.ts tests/contract/inventory-sql.test.ts
npm audit
npm audit --omit=dev
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-app-builder forge lint --non-interactive --environment development
```

Audits currently fail with documented upstream advisories; passing other checks does not waive them. Investigate any changed results. Once explicit owner authorisation for the reported MAJOR_VERSION_RULE, development deployment/upgrade and risk disposition is recorded (the flags below acknowledge only that approved major-upgrade rule; do not use --no-verify):

```sh
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-app-builder forge lint --non-interactive --environment development --approve MAJOR_VERSION_RULE
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-app-builder forge deploy --environment development --inspect --non-interactive --approve MAJOR_VERSION_RULE
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-app-builder forge install --upgrade --environment development --site "$LIGHT_HOUSE_DEV_SITE" --product jira --non-interactive
```

Record actual new major/minor version, app identity, installation consent, output/exit status and time. Adding SQL requires major-version consent; do not guess the resulting version. Review saved official artifacts privately for dependency exposure, secrets, resources and excluded tooling before acceptance. Local esbuild is not the official packaging gate.

## Installed exercises

1. As a non-administrator without any grant, load status/tenants. Verify no ISP data is returned; forged accountId/isAdmin/installationId payload claims do not permit bootstrap/mutation. As the authorised Jira administrator, load schema status and explicitly queue the development migration. Record provisioning/ready or failed state and consumer outcome. Ready requires all fifteen named checkpoints. Reloading must never run DDL.
2. Explicitly queue again to verify safe rerun. Use controlled development fault testing to exercise a failed/checkpoint-partial migration and retry without destructive DDL or unrelated data deletion. Record actual SQL query-policy/type/collation/native error results. Check root/tenant composite keys and unique indexes in the SQL schema viewer. No mocked result substitutes for this step.
3. Bootstrap Lantern Fibre, then Beacon Transit. Verify bootstrap cannot be claimed by an ordinary authenticated user. After bootstrap, select each ISP and run seed batches explicitly (eleven batches of at most four records). Record per-ISP 44 records, stable IDs and completion. Reload the app; persisted records must remain. Rerun all batches; counts/IDs/configuration must remain unchanged, with no duplicate receipt materialisation.
4. Use separate consenting test accounts for viewer/operator/admin grants. Verify selection is membership-scoped; viewer mutations/configuration and operator membership/policy configuration fail. Revoke/expire a grant and verify the next request denies access. Team membership or manual assignee mapping must never grant app access. No real customer contacts may be entered.
5. Test direct IDs and relationship injection between the two logical ISPs, including uplink site/carrier, protected link, customer tier/site, service customer/site/tier, dependency, team/assignee and policy tier. Verify same-ISP active references succeed; foreign/missing/retired references and invalid backup/self/cross-site protection fail. Assert joins and pagination never expose the other ISP. Create/retire competing records to exercise tenant admission on real SQL.
6. Edit a record in two app sessions: first accepted write increments version; stale second write returns CONFLICT. Capture actual rows.affectedRows semantics for both conditional success and stale rejection through controlled private instrumentation if needed; do not log SQL values or arbitrary errors. Record native duplicate handling; unrecognised error shapes must remain safely UNAVAILABLE until supported.
7. In development, as an ISP admin, click **Create synthetic partial-write repair probe**. It deliberately returns REPAIR_REQUIRED after durable target/tenant writes. Verify the known DEMO-REPAIR-PROBE site and pending state survive reload. Competing mutations must remain blocked. Click **Repair pending ISP mutation**, verify one receipt and cleared target/tenant intents, rerun repair/probe and confirm no duplicate site/receipt. Also exercise controlled failure after policy write/receipt and before clears; replay must converge. Never introduce a generic production fault endpoint.
8. Edit a seeded draft policy with expected version; choose finite exclusive effective_until before publishing if another version will follow. Publish exact draft with current tier version. Verify the trusted publication actor, preserved content, overlap/gap rejection, stale tier rejection and successful contiguous next version. Published content must reject edits. P1/P2/P3 are demonstration settings only; no countdown/Jira SLA/notification behaviour is claimed.
9. Run original manual foundation health diagnostics: metadata, backend availability, safe error state, internally generated UUID and actual correlated backend log. Record UI Console results separately. Installed visual theme comparison remains the accepted Sprint 5 deferral, not a Sprint 1 pass.
10. Review SQL compute requests/duration/storage and Functions/log usage in the Developer Console against the pre-approved budget; record the actual window and readings. Compare bounded batch/query expectations from cost-governance.md. No billing changes or paid resources are authorised. Missing metrics are an evidence gap.
11. Actual second-installation isolation requires another genuine, explicitly authorised installation. None is available/authorised in this execution. Keep this gate open; do not create a site or install elsewhere as part of this procedure. Two local database simulations only establish application test behaviour.

Record commands, exit codes, timestamps, test accounts by synthetic/private reference, observations and failures in audit/execution report without publishing private site IDs/account records, raw SQL parameters or scan artifacts. Do not merge with missing live acceptance evidence.

## Independent readiness review and evidence sheet — 2026-11-26

Read [owner decision package](../project/sprint-1-readiness-review.md) before executing. Foundation LH-014 acceptance does not cover Sprint 1 automatically. The linter reports scope modification; the added SQL module also independently requires a major upgrade. Approving the CLI rule is not installation consent or runtime acceptance. No destructive cleanup, uninstall/reinstall or app registration change is part of this procedure.

Record pre-session and post-session SQL requests/compute/storage, Functions duration/invocations and logs from the Developer Console, using the same environment/installation/time window. Capture initial readings before deployment and final readings after metrics settle; record timestamp/window and any unavailable/delayed readings. Record actual differences, not forecast zero. Proposed 5,000 SQL-request session planning limit requires owner agreement; stop on unexpected growth or throttling. It is not a configured spending cap. Do not repeatedly click migration/seed buttons to overcome provisioning latency. After DDL throttling wait at least 60 seconds and inspect readiness before an explicit retry.

Use this checklist as separate evidence rows, with UTC time, expected/observed outcome and private evidence reference. Every box starts open:

- [ ] 1. Development deploy succeeds; record actual version and inspect official package/resources privately for vulnerable leaves, secrets and excluded tooling.
- [ ] 2. Existing Jira installation upgrades to the new major with administrator scope/SQL consent; confirm installed version.
- [ ] 3. Console confirms native SQL database provisioning for that installation; no second database/site is manually provisioned.
- [ ] 4. Queue migration as verified Jira admin; all fifteen named checkpoints and matching physical schema are present; readiness reaches ready/v1.
- [ ] 5. In a quiet window queue again; record checkpoint names, schema and existing fixture state unchanged, with no destructive DDL. Respect the 25-DDL/minute limit.
- [ ] 6. Ordinary ungranted user is denied bootstrap/migrate despite forged payload identity/admin claims; verified Jira admin bootstraps Lantern Fibre.
- [ ] 7. Seed eleven explicit four-record batches; record 44 synthetic inventory rows across the eleven entity kinds, IDs and completed progress.
- [ ] 8. Reload the application/browser and list all kinds/pages; record the same persisted identities and fields.
- [ ] 9. Repeat all eleven batches; counts, IDs, fields and receipt count remain unchanged. Do this before adding the repair probe so fixture counts remain clear.
- [ ] 10. Bootstrap/seed Beacon Transit in the same installation; record distinct tenant IDs and independent 44-row inventories.
- [ ] 11. Grant a consenting account access only to Lantern Fibre; selection/direct requests for Beacon Transit deny access and return no rows. Revoke/expire grants and repeat subsequent requests. Payload accountId/installationId/isAdmin claims must not help.
- [ ] 12. Use Lantern Fibre's valid customer/site/tier/service/uplink/team IDs in Beacon Transit create forms; foreign relationships must be rejected, while corresponding same-tenant controls succeed. Exercise every relationship field in the existing negative-test matrix. Preserve the matrix of results privately.
- [ ] 13. Two sessions load the same record/version; first edit succeeds/increments version, second returns CONFLICT and preserves the first edit. Reload before retrying.
- [ ] 14. As tenant admin run Create synthetic partial-write repair probe; expect REPAIR_REQUIRED, persisted DEMO-REPAIR-PROBE and blocked competing mutation after reload. Run Repair pending ISP mutation, reload, repeat repair/probe and verify one site/receipt and cleared intents. This is the shipped controlled-failure path; no generic fault endpoint is needed.
- [ ] 15. Run foundation status diagnostics and verify actual server-generated UUID/correlated allowlisted log, success/error contract and console observations. Preserve accepted Sprint 5 theme deferral honestly.
- [ ] 16. Record real resource deltas/metrics window, compare with planning model and resolve any anomalous consumption before accepting runtime.

Membership expiry currently requires an authorised direct resolver request: the grant UI sends expiresAt:null. Use a private development test harness invoking the existing inventory resolver with an ISO UTC expiresAt and expected grant version; never add a bypass or claim UI expiry configuration exists. Record the harness/reviewed request privately. Account IDs/site values must not enter public evidence.

The shipped probe establishes failure after target write. More extensive native failure testing (checkpoint failure, post-policy/pre-receipt, post-receipt/pre-target-clear and post-target-clear/pre-tenant-clear) needs an explicitly reviewed temporary development-only instrumented artifact. Use a fixed server-side throw of InventoryError('UNAVAILABLE') at exactly one named boundary, guarded by trusted DEVELOPMENT context and existing admin admission; no client-selectable failure selector or generic production endpoint. Validate and inspect the patch before any separately authorised redeployment; exercise once, deploy the reviewed original code again under authorisation, then repair/retry and compare IDs/receipts/versions. Preserve public code unchanged and record actual artifact hashes privately. Do not mark these additional failure phases passed from SQLite tests or the single shipped probe. If instrumentation is not approved, report these phases untested; do not delete checkpoints/data to manufacture failures.

## Genuine second-installation isolation — separately gated

There is currently one authorised Jira development installation. The following is a future procedure, not site creation/install authorisation. It does not ask for another sprint and does not justify fabricating a pass.

1. Owner identifies and explicitly authorises a second genuine Jira installation, appropriate consenting administrator/test accounts, scope/SQL consent and its resource budget. Do not provision a paid resource or another site automatically. Record installation references privately as A/B; public evidence uses those labels only.
2. Use the **same registered app and approved development version**, not another app identity/environment pretending to be a second installation. After authorisation, privately set LIGHT_HOUSE_SECOND_DEV_SITE and execute:

   ```sh
   forge install --environment development --site "$LIGHT_HOUSE_SECOND_DEV_SITE" --product jira --non-interactive
   ```

   This is a fresh install, not --upgrade. Confirm the two actual installations in CLI/console privately. Include both in usage accounting; allowances are not multiplied.

3. In B, confirm an independent empty/provisioning SQL database, explicitly queue B's migration as B's Jira administrator, then bootstrap/seed a synthetic tenant. Use the same logical slug/fixture labels as A plus one distinctive synthetic marker in each installation. Confirm each installation's checkpoints/readiness independently. Do not reuse A's installation metadata rows.
4. In B, request list/save/repair/grant with A's tenant/record IDs and forged installationId/accountId fields using the existing resolver. Expect DENIED/NOT_FOUND with no A data or mutation. Repeat A→B. Positive controls with each installation's own IDs must succeed. Explicitly test an A tenant ID when the same actor is administrator in both installations; global Jira admin authority must not select A's database from B.
5. Queue migration in B and verify A's schema/readiness/row versions/receipts are unchanged. A forged migration body must not select another installation; only Forge-delivered, trusted-context consumer execution can establish this live boundary. Do not create a public queue/webtrigger test endpoint.
6. Reload both installations and check only their own marker/data. Compare Console SQL schema/usage selections privately and document actual isolation results, not just two UI windows or two local databases. No secret/KVS crossover is implemented in Sprint 1, so do not invent a secrets test result.
7. Do not uninstall/delete either installation or data without separate owner approval. Keep LH-101 genuine installation isolation open until this procedure runs successfully. Under current acceptance criteria, missing second-installation evidence blocks Sprint 1 completion/merge; it need not prevent a separately approved first-installation development acceptance session.

## Current execution authorisation — 2026-11-26

Owner has explicitly approved this first-installation development session, SQL/consumer/read:jira-work major consent, all fifteen reviewed non-destructive migrations, synthetic seed and controlled native tests, exact-tree LH-014 exception and 5,000 SQL-request planning budget. This supersedes pending-authorisation preconditions above. Second-site installation and merge remain unauthorised. Browser host is unavailable in this session; owner UI actions and backend log verification must remain distinct evidence. Do not claim native passes from local tests or deployment alone.

## Second-installation decision requirements — verified 2026-11-26

Sprint 1 needs Jira: the manifest uses jira:globalPage and read:jira-work. JSM/Confluence are not needed for these inventory tests; genuine JSM workflow acceptance belongs to later assigned work. Prefer an already existing owner-controlled second Jira cloud site with consenting administrators and test accounts, after separate explicit approval. Existing site availability, free developer-site entitlement and subscription expiry cannot be established by this session's tools; no perpetual free eligibility is promised.

Official alternatives: [traditional development-site setup](https://developer.atlassian.com/platform/forge/getting-started/) links cloud-dev; its signup redirect was inaccessible to this verifier. [Demo development sites](https://developer.atlassian.com/platform/forge/provision-a-demo-development-site/) are fully featured Jira/Confluence/JSM/Rovo sites, one active per developer, normally 90 days. A pre-existing active demo site may be suitable if genuinely distinct from installation A. Capacity/eligibility/expiry must be checked by the owner; creating a site or changing subscriptions is not authorised. Do not invoke site provision or install --demo-site, which may offer site creation. No added Rovo feature is part of Light House.

B adds one per-installation SQL database (development storage limit 128 MiB, 200 tables) but does not multiply app-level monthly allowances. Plan approximately 36 migration calls + 6 clean rerun + 696 initial UI seed + 110 rerun, about 848 statements for one tenant before status/list/security tests, plus function/SQL compute/storage/log overhead. These are source/local planning counts, not measured consumption; budget B separately and stop on unexpected usage. Administrator must approve the same read:jira-work/SQL major-version consent, with no billing/paid changes. LH-014 acceptance must be explicitly reassessed for B: the current exception is limited to A. Review imports/dependencies/version and the exact consent screen again.

After approval use the same registered app and development version major 3, and the genuine A/B isolation procedure above (fresh install, independent schema/checkpoints, distinct synthetic markers, bidirectional foreign-ID/migration admission tests and unchanged-A controls). Confirm version has not moved before installing; pin --major-version 3 only if it remains the reviewed version. Required follow-up command after approval: forge install --environment development --site "$LIGHT_HOUSE_SECOND_DEV_SITE" --product jira --major-version 3 --non-interactive. No execution now.

## Browser-unavailable owner smoke checklist

1. Open Apps → Light House in the existing authorised site. Record installed page load and health-check outcome; agent checks backend.status log correlation.
2. Click **Load tenants and schema status**, then as verified Jira administrator click **Queue development migration** once. Wait for completion and explicitly reload status. Report displayed schema result; do not repeatedly queue. Agent checks available backend evidence. Console SQL provisioning/checkpoint/physical schema evidence is still needed independently of rendered ready/v1.
3. Once ready/v1 is verified, bootstrap Lantern Fibre, choose it under Authorised ISP and click **Seed next batch** eleven times, waiting for each completion (offsets 0,4,…,40). Load each inventory type; expect four rows per type, 44 total. Repeat for Beacon Transit only within remaining budget.
4. Refresh, reload tenants, reselect the ISP and load each type: same identities/fields/counts. Repeat the eleven seed batches before creating any repair probe: no changed IDs/fields/counts or additional receipts. Report visible results, not hidden Bridge payloads.
5. Advanced membership/isolation/concurrency/repair tests follow the sixteen-gate evidence sheet; smoke success alone does not satisfy them. Never enter real customer information or paste credentials/HAR. Record post-session usage with the same reporting period after metrics settle.
