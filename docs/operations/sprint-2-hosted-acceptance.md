# Sprint 2 hosted checkpoint and consolidated acceptance

2026-11-27. Branch `sprint-2/zabbix-border-control`; deployed source commit `2b97545fe87e5d3d371ab2982da7e41b7614d834`. This update records evidence and prepares the remaining session; it executes no hosted mutation. No redeployment, tunnel, source, URL generation, migration, installation, publication or merge was performed by this review. Sprint1 data and R-01–R-14 release requirements remain preserved.

## Deployment, installation and health evidence

| Gate                           | Evidence and attribution                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Exact source                   | Owner verified commit and clean tree before deployment; independently confirmed local HEAD and clean entry tree at that commit                                                                                                                                                                                                                                                                                                                   |
| Authenticated lint             | Owner reports zero errors, zero warnings and one `MAJOR_VERSION_RULE` approval; supersedes historical inaccessible lint for this artifact                                                                                                                                                                                                                                                                                                        |
| Manifest/deployment            | Owner reports valid manifest and successful DEVELOPMENT deployment, major **4**, at **2026-11-27T18:22:04.454Z**; full minor/patch version was not supplied                                                                                                                                                                                                                                                                                      |
| Verification bypass            | Owner used `--no-verify`, which disables pre-deployment checks. The separately reported lint pass is distinct evidence; deployment did not rerun those checks. No claim that deployment verification passed                                                                                                                                                                                                                                      |
| Existing installation          | Owner reports Jira upgrade major3→4, additional `storage:app` consent accepted, status **Up-to-date**; no new installation                                                                                                                                                                                                                                                                                                                       |
| Rendered health                | Owner reports Bridge Resolved, backend available, response contract Valid, integration readiness not-configured, UUID `c75d6f67-7e08-41d3-8948-8a675270c8bd`                                                                                                                                                                                                                                                                                     |
| Independent hosted correlation | Read-only `forge logs --environment development --since 2026-11-27T18:22:04.454Z --limit 1000 --grouped --non-interactive` exited0 through supported elevated access. Exactly one matching allowlisted `backend.status` / `success` event at **2026-11-27T18:31:37.509Z**. CLI emitted time only; date uniquely assigned from the bounded same-day retrieval window ending before18:35:28Z. Exact displayed UUID match, not a temporal candidate |

Deployment/install/health do not prove SQL migration, KVS writes, source authentication, queue processing, Zabbix connectivity, roles or isolation. Owner completion reports are labelled above; independent deploy-history retrieval was not repeated.

## Frontend provenance and expected controls

The exact source retains `APPLICATION_METADATA` in `src/domain/value-objects/application-metadata.ts`: Light House / light-house /0.1.0 /Sprint1 — tenancy and synthetic inventory. Both `App.tsx` and backend `getStatus` use that same constant. `getStatus` also always returns `integrations: 'not-configured'`; it is not a probe of configured monitoring sources or SQL readiness.

The new description in `static/app/src/App.tsx` matches the owner-observed “Monitoring intake and inventory require explicit source and Forge SQL setup.” `App` renders both Inventory and Monitoring. Vite builds that entry into `dist/ui`, the manifest's `light-house-ui` resource. This supports current resource delivery; the old label is expected from this commit and does not itself establish stale resources. No cosmetic source change or redeployment is warranted. Hosted visibility of the controls below still needs a fresh observation; description agreement alone is not full bundle attestation.

Expected section: **Monitoring — automated Border Control**. Always present: **Load monitoring tenants**, **Monitoring tenant**, **Load monitoring**. After selecting an admin tenant: **Monitoring administration**, **Queue monitoring schema setup**, **Recover up to 20 interrupted events**, **Clean up to 20 inactive credentials**, **Monitoring source**, **Source name**, **New source secret**, **Create monitoring source**. Selecting an existing source exposes **Rotation overlap seconds**, **Rotate source credential**, **Revoke monitoring source**, mapping and receipt controls. Sources, authenticated intake outcomes and synthetic receipts appear only after a successful overview; pagination requires returned cursors. Backend authorisation remains authoritative.

The `e2e/` read-only harness is explicitly pinned to3.3.0 and has no monitoring controls. Do not change private target metadata to evade it, use it for major4 hosted execution, or expand its allowed mutations. Its passing local tests are harness evidence only.

## One consolidated preflight before any write

Use the existing private approved DEVELOPMENT target and consenting Lantern Fibre administrator. Verify the actual full installed version/major4 and current membership plus Jira global admin permission. Do not infer installation/site IDs from examples or health metadata. Remaining session needs an explicit bounded owner authorisation for additive v002, one synthetic source, private URL generation and HTTP acceptance, plus the dependency-risk disposition below; completed deployment/scope consent does not automatically grant these operations.

Capture once, through existing authorised Console/UI surfaces:

- Fresh SQL, Functions, KVS and charges with UTC capture/data-through, comparable DEVELOPMENT filters, complete activity ledger since historical286 SQL requests, lag bound and pending/in-flight jobs. Historical286 at13:08 is not current consumption. No fresh values have been supplied here.
- Complete safe Sprint1 pending/receipt baseline and known probe state, not the historical10-row/five-receipt sample. Project only pending booleans/counts, receipt counts/uniqueness and necessary synthetic versions; never payload/account/installation data. Unknown intent or unavailable safe complete readback blocks writes. Monitoring baseline must also establish whether a prior migration/source/job exists; table absence is distinct from a failed or inaccessible read.
- Shared allowance: all prior preflight/B.1/B.2/Sprint2 work counts inside additional2,000/cumulative5,000. Proposed Sprint2 reservation600 is included, not extra or already approved. Reconcile remaining Sprint1 reservations before allocating600; do not silently add600 to fully reserved1,750+250. Require `M + U + P + R <= 5,000`, no double counting, with justified unmetered bound and in-flight/retry cost. Unknown lag coverage/headroom stops writes. No arbitrary buffer or new cost ceiling.
- Current full and omit-dev audits each exit1: **18 affected packages,11 high/7 moderate**, same three roots GHSA-c8x8-7fp4-3x9w, GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249. Earlier12(5/7) and17/11 results remain historical; changed inherited package attribution is not remediation or proof of new exploitability. No dependency/lock changes. Explicit DEVELOPMENT-only review must cover current counts, public ingress and encrypted-secret access. Production remains blocked. Existing scanner coverage is incomplete; native security/retention/licence gates remain open.

If those observations and bounded scope are approved together, execute the following sequence once. No additional test identities are required for admin synthetic intake; role/second-installation acceptance stays open. Keep a single usage/operation ledger. Stop for wrong target, unknown write outcome, unexpected tenant access/data, disclosure, unbounded pending state, throttle/charges or insufficient budget. Do not repair, seed or reset Sprint1 to clear a prerequisite.

## Exact app controls: v002 and verification

1. In **Synthetic network inventory**, click **Load tenants and schema status** once; require fresh completion and `Schema: ready (v1)`. **Read development schema diagnostics (Jira administrators)** is an optional bounded v001 diagnostic, not a v002 inspector. No bootstrap/seed/repair button is needed.
2. In **Monitoring — automated Border Control**, click **Load monitoring tenants**, wait for completion, select **Lantern Fibre (admin)** in **Monitoring tenant**. Click **Load monitoring** once to establish the current result. Before setup, `NOT_READY` is an expected failed request, not an empty success. If already successful, inspect the existing schema/sources rather than blindly queueing another setup.
3. With preflight and migration authority satisfied, click **Queue monitoring schema setup** once. Record UTC and displayed correlation. Expected text: **Monitoring migration queued. Reload monitoring after completion.** This proves queue admission only. The worker gets a different correlation; the UI control UUID cannot prove worker completion.
4. After completion evidence, click **Load monitoring** once and require a fresh **Loading monitoring…** → **Monitoring loaded. Correlation ID: …** transition, valid overview and actual source/receipt/outcome counts. Success is application readiness evidence: repository checks monitoring ready1/version2 joined to DEVELOPMENT inventory ready/version1. No automatic polling/retries; allow only bounded approved reloads, stop on persistent failure.
5. In existing Developer Console **SQL > Manage > Development > exact existing site > Schema details**, inspect all six additive tables and compare columns/keys/indexes to committed `src/infrastructure/sql/migrations.v002.json`: `monitoring_schema_state`, `monitoring_sources`, `monitoring_credentials`, `monitoring_resource_mappings`, `monitoring_inbox`, `monitoring_observations`. Through safe **Table data** projection, require current installation schema_version2/ready1, five checkpoint names (every migration except the registry table), valid UTC updated_at; v001 installation_metadata remains ready/version1 and prior inventory is preserved. Do not export installation IDs, secret references, event_json or account/intent payloads. If Console cannot safely expose a field/index, record physical verification BLOCKED rather than infer it from overview success. Do not issue console DDL.

## Synthetic source provisioning

After ready-v002, select **Create new source** in **Monitoring source**, set **Source name** to **Synthetic Zabbix acceptance**. Generate at least32 random bytes base64url privately in a password manager; retain it there for the terminal run. Enter only in **New source secret**, click **Create monitoring source** once. Field clears on submission even if it fails; clearing is not persistence evidence. On success record public source/key UUIDs and version/correlation. **Load monitoring** again, select that exact active source, confirm source binding/current key/version. On uncertain creation reload first; do not duplicate or rotate as a diagnostic.

Prefer the unmapped synthetic resource `synthetic:lh-103-acceptance`: expect durable receipt then **manual_triage / UNKNOWN_MAPPING**, preserving original occurrence time. Mapping is optional and separately bounded: only an approved existing active same-tenant uplink via **Add resource mapping**, without editing Sprint1 inventory. Rotation/revocation/recovery/cleanup are optional separately authorised cases, not prerequisites for the initial10-request run. No real Zabbix server is connected; version/media/macro/transport acceptance remains open.

## Private URL and terminal handoff (prepared, NOT executed)

CLI syntax was checked against installed CLI source/help and exact official docs2026-11-27. Run only after scope, preflight and URL authority pass, in an owner-controlled zsh terminal at the reviewed repository. Do not enable tracing or print values. The private ignored directory below must be a real owner-controlled directory, not a symlink; stop if it is not. Use the exact existing installation ID from the private owner record. URL stdout/stderr remain private. No `--readSecretKey`/`--noKeyExpiry`: this artifact implements application bearer authentication, not Forge HMAC configuration.

```zsh
set +x
setopt noclobber
umask 077
mkdir -p e2e/.local/monitoring
chmod 700 e2e/.local/monitoring
read -rs 'LH_INSTALLATION_ID?Approved existing DEVELOPMENT installation ID: '; print
forge webtrigger create --environment development --installation-id "$LH_INSTALLATION_ID" --functionKey light-house-zabbix-intake --non-interactive > e2e/.local/monitoring/webtrigger-private.txt 2> e2e/.local/monitoring/webtrigger-error.txt
LH_CREATE_STATUS=$?
unset LH_INSTALLATION_ID
# Continue only if LH_CREATE_STATUS is 0 and the private result matches the target.
# Read/copy the URL privately into your password manager; never attach this file.
```

If creation fails, stop; do not automatically retry, list all URLs or disclose the private error file. A generated URL is not an authentication credential or proof of source binding. After privately checking it, run the terminal acceptance in a subshell so inputs are discarded afterwards. Approval marker must follow actual approval; setting it is not authorisation. Clear stale optional revoked inputs for this initial run. Keep the source token out of command arguments and shell history.

```zsh
(
  set +x
  setopt noclobber
  umask 077
  unset LH_REVOKED_KEY_ID LH_REVOKED_SECRET
  read -rs 'LH_WEBTRIGGER_URL?Private approved webtrigger URL: '; print
  read -rs 'LH_SOURCE_KEY_ID?Provisioned current key UUID: '; print
  read -rs 'LH_SOURCE_SECRET?Private source token: '; print
  export LH_WEBTRIGGER_URL LH_SOURCE_KEY_ID LH_SOURCE_SECRET
  export LH_ACCEPTANCE_APPROVAL=approved-development-synthetic-session
  node scripts/webhook-acceptance.mjs > e2e/.local/monitoring/acceptance.json
)
```

Record the exit status; inspect only the curated report locally. Initial run uses10 requests (11 with an explicitly approved revoked pair), at most15seconds each, no redirects/network retries. Expect401 missing/wrong auth;400 malformed/unsupported/tenant-field;202 valid event and three exact duplicates;409 changed-content conflict. Runner dry-run: `npm run test:webhook:dry-run` (safe now, no HTTP). If the deployed URL fails the runner's strict URL shape validation, stop and review; do not relax it to force a run.

Then **Load monitoring** once after processing: reconcile runner external event ID, exactly one durable receipt, duplicate count3 for the valid+three replay path, source, original timestamp, final state/reason and safe authenticated outcomes. Concurrent conflicts/retries/unexpected results require actual persisted reconciliation rather than an assumed count. Static HTTP bodies expose no generated receipt/correlation ID; runner correlation remains null/processing NOT_OBSERVED until independently reconciled. Wrong/missing authentication has no tenant-attributed UI outcome; correlate only allowlisted ingress result/UUID/UTC logs, never raw request/header/body dumps. Rotation absent means revoked-case NOT_TESTED. A clean recovery sweep never proves crash recovery.

Return one curated handoff: actual version; pre/post usage and data-through/bounds; pending/receipt baseline; each action UTC/correlation/outcome; six-table/checkpoint observations or explicit gaps; public source/key UUIDs; safe terminal statuses; durable event/receipt/duplicates/state; unchanged Sprint1 inventory and unresolved gates. Do not share URL/token/private files. No further deployment, tunnel, Sprint3 or release acceptance is implied.

References verified2026-11-27; Forge/ADS MCP unavailable in this session, installed debugger/cost/builder/review SKILL.md files not found at project/user skill paths; historical skill/scanner evidence is not rerun or upgraded by this documentation review: [deploy and no-verify](https://developer.atlassian.com/platform/forge/cli-reference/deploy/), [logs](https://developer.atlassian.com/platform/forge/cli-reference/logs/), [webtrigger create](https://developer.atlassian.com/platform/forge/cli-reference/webtrigger-create/). Installed CLI corroborates `--functionKey` names the manifest webtrigger key, not the function handler key.
