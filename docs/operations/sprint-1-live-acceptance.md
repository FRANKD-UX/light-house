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

Audits currently fail with documented upstream advisories; passing other checks does not waive them. Investigate any changed results. Once explicit owner authorisation and risk disposition are recorded:

```sh
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-app-builder forge deploy --environment development --inspect --non-interactive
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
