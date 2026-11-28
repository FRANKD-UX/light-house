# Programme security assessment — dependency and ingress review

Verified 2026-11-27 against deployed implementation `2b97545fe87e5d3d371ab2982da7e41b7614d834` and unchanged root dependency lock SHA256 `93077a48eaf451291acd6f79c0c712212807cd5446bd1f4329a42386fc578679`. This focused composition review investigates the reported twelve-to-eighteen increase and its monitoring exposure. It does not certify the later programme implementation, native tenant isolation or release readiness. No dependency, application, manifest or lockfile change was made by this workstream. Prior uncommitted deployment evidence was preserved.

## Finding and disposition

The increase is reproducibly **cache-sensitive inherited package classification** on the same installed dependency tree. It is not evidence of six newly installed packages or six new advisory roots. This conclusion follows controlled comparisons below, rather than an assumption about caches. The exact stale/calculation record or registry timing responsible remains unproven; the owner's cache was neither inspected nor deleted. Retain **18 affected package names, 11 high / 7 moderate**, as the conservative observed result. Both lower and higher reports fail.

No confirmed exploitable Light House application defect was established in the reviewed dependency-to-sink paths; no application CVSS score or PoC is invented. The vulnerable leaves remain installed. A supported nonbreaking remediation was not established: current Forge parents and Atlaskit editor continue to require affected versions/ranges. DEVELOPMENT exposure approval for the remaining bounded native session remains an owner decision; existing deployment and scope consent are not a blanket vulnerability waiver. Production/release stays blocked on LH-014 and other mandatory gates.

## Controlled audit evidence

Node22.23.4/npm10.9.9; each command exit1. Four contemporaneous read-only audits used the unchanged package/lock/node_modules tree, separate empty cache directories for the fresh cases and no audit fix. Raw JSON is ignored under `security-audit-artifacts/programme-*.json`.

| Invocation                                                                  | Count                 | Advisory roots   |
| --------------------------------------------------------------------------- | --------------------- | ---------------- |
| `npm audit --json`                                                          | 18:11 high/7 moderate | Same three below |
| `npm audit --omit=dev --json`                                               | 18:11 high/7 moderate | Same three       |
| `npm audit --json --cache /tmp/light-house-programme-audit-full`            | 12:5 high/7 moderate  | Same three       |
| `npm audit --omit=dev --json --cache /tmp/light-house-programme-audit-prod` | 12:5 high/7 moderate  | Same three       |

Default reports also return empty aggregate affected ranges for some leaves and different fixAvailable values; fresh reports calculate explicit ranges and suggest a Bridge5.5.0 major downgrade. Neither fix suggestion is adopted. Cache-sensitive calculated output is not a security remedy. npm documents registry advisory processing, inherited meta-vulnerabilities and cached calculations in its [audit algorithm](https://docs.npmjs.com/cli/v10/commands/npm-audit/#calculating-meta-vulnerabilities-and-remediations), verified2026-11-27.

Git history comparison shows LH-103 added only `node_modules/@forge/kvs@2.1.3` to package records; its sole dependency `@forge/api:^8.5.1` deduplicates to existing8.5.1. No other package version changed from the prior lock. KVS explains the earlier11→12 moderate-parent increment, not the six additional high entries. Earlier pre-KVS17/11 observations and completion12(5/7) remain historical evidence.

The exact six additional high entries are existing ProseMirror wrappers inherited through view1.41.5: commands1.7.1, dropcursor1.8.2, history1.5.0, keymap1.2.3, state1.4.4, utils1.2.2. Their via graphs lead to the same view advisory; state/view also form a dependency cycle. Their absence in the fresh report does not mean those installed packages are safe.

## Advisory dates, ranges and paths

Official publisher/advisory pages reopened2026-11-27. All advisory updates predate this programme; none of these three is newly published between the twelve/eighteen observations.

| Root                                                                                                         | Installed / affected / patched                      | Publication/update                                  | Threat prerequisite                                      |
| ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------- |
| [GHSA-c8x8-7fp4-3x9w, CVE-2026-104847](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w), high, CWE-79      | view1.41.5; affected <1.42.3; patched1.42.3         | Maintainer Aug25; database Oct5; updated Oct5,2026  | User pastes attacker HTML into the affected editor       |
| [GHSA-3g3m-2fjr-6pw4, CVE-2026-118773](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), moderate, CWE-400 | glob13.0.7; affected9.0.0–14.0.1; patched14.0.2     | Maintainer Oct27; database/update Oct30,2026        | Attacker-controlled patterns/tree with aborted traversal |
| [GHSA-g3hv-75wg-m249, CVE-2026-118764](https://github.com/advisories/GHSA-g3hv-75wg-m249), moderate, CWE-405 | minimatch10.2.6; affected>=7,<11.0.1; patched11.0.1 | Maintainer Oct27; database Oct30; updated Nov4,2026 | Attacker pattern reaches high-optimisation matching      |

`npm ls ... --all` exit0 confirms these production-classified paths:

- Bridge7.4.0 → adf-schema56.7.3 → editor-prosemirror8.0.3 and generator4.0.4 → editor-prosemirror9.0.0 → view1.41.5 plus six wrapper packages above. Editor8/9 pin view1.41.5 exactly.
- API8.5.1 → manifest13.9.1 → glob13.0.7 → minimatch10.2.6; Bridge also directly pins manifest13.9.1. Events3.0.11, SQL4.0.11 and KVS2.1.3 inherit API.
- ESLint/typescript-eslint separately use minimatch11.0.9, outside the reported leaf range; they do not remove the vulnerable production branch.

All18 package names/versions are accounted for by these paths: Bridge7.4.0; API8.5.1; Events3.0.11; KVS2.1.3; SQL4.0.11; manifest13.9.1; adf-schema56.7.3; generator4.0.4; editor8.0.3/9.0.0; glob13.0.7; minimatch10.2.6; view1.41.5; six wrappers listed above. An affected package name is not an independent advisory count.

## Supported remediation investigation

Successful read-only `npm view <package> version dependencies engines license --json` queries on2026-11-27 returned latest Bridge7.4.0, API8.5.1, manifest13.9.1, KVS2.1.3, editor-prosemirror9.0.0 and adf-schema57.7.63. No engines field was returned for those latest records. Forge packages retain their publisher Developer Terms licence metadata; Atlaskit records Apache-2.0. Metadata is saved privately in `programme-metadata.json`.

Bridge still selects adf-schema^56.7.0 and pins manifest13.9.1. Even latest adf-schema57.7.63 selects editor^9.0.0, whose latest9.0.0 pins vulnerable view1.41.5. Manifest still uses glob^13.0.0; patched glob14.0.2 is outside that major range and retains a minimatch compatibility review. A direct view patch, transitive override, Bridge downgrade or unrelated Atlaskit major therefore lacks supported parent compatibility evidence. Do not apply one merely to reduce audit counts. No safe supported nonbreaking dependency edit was justified today. Recheck publisher releases before the next exact-artifact deployment review; if a verified compatible parent appears, pin it, clean-install, audit, test, inspect bundles and review permissions/licences before replacing the checkpoint.

## Exposure and trusted-boundary evidence

Manifest map: React Custom UI resource `dist/ui` → status resolver/inventory/monitoring actions; static v2 `light-house-zabbix-intake` → `index.monitoringIngress` → monitoring service; SQL-backed schema/worker consumers. Runtime nodejs22.x, read:jira-work/storage:app scopes, no external fetch/remotes/CSP expansion. Only existing `api.asUser().requestJira` call to `/rest/api/3/mypermissions?permissions=ADMINISTER` was present in the reviewed deployed source; later integration changes need their own review.

Current isolated esbuild graphs use the deployed entrypoints and write only ignored artifacts. Backend30 inputs with Forge SDKs external as the existing build; UI157 inputs. Neither graph has affected glob/minimatch/ProseMirror leaf inputs or output contributors. Searches find no app editor/paste, glob/match call or HTML injection sink. This reduces demonstrated application reachability; it is not proof about all Forge-managed SDK internals or the official deployment wrapper. Production classification alone is not runtime reachability, and local smoke graphs are not downloaded hosted artifacts.

The new ingress does not invoke those leaf APIs. It authenticates before JSON parsing/trusted persistence: `if (!this.deps.crypto.equalSecret(stored.secret, token)) return 'unauthorised';` in `src/application/monitoring/service.ts`, then strict payload/UTC/size/rate checks and tenant-scoped inbox operations. SQL/KVS binding uses trusted installation and stored source authority, not payload tenant fields. `src/infrastructure/monitoring/crypto.ts` uses SHA256 digests with `timingSafeEqual`; timestamps provide bounded replay age, not HMAC integrity. `src/infrastructure/monitoring/kvs-secrets.ts` writes `client.setSecret(key, value, { keyPolicy: 'FAIL_IF_EXISTS' })`; SQL contains reference intents. Public responses are static; safe logs project fixed outcomes, not credentials/body. Manual inspection of logger.ts and structured-logger.ts covers the parser gap below.

Residual exposure still needs disposition: stolen bearer permits source forgery until disable; unauthenticated requests can reach credential lookup and consume platform/SQL resources before the per-authenticated-source limiter. Do not invent a global unauthenticated rate guarantee. Native KVS/rotation/revocation, queues/partial failures, tenant/installation isolation and actual resources are unverified by this review. Retention, licence and release requirements stay open. These are threat/evidence concerns, not newly demonstrated exploitable defects.

## Coverage and evidence gaps

Applied installed Forge security skill; read global baseline, misc/software-composition, webtrigger index/security, secrets-storage index, auditing index and injection index/RCE rule for deterministic leads. This is a focused dependency review, not a fresh comprehensive authz/SQL/tenant audit; authn-authz, tenant-isolation, manifest-config indexes were not loaded deeply; egress-remotes and rovo-agents lack corresponding manifest signals. Historical Sprint2 manual/security evidence remains separately scoped.

Initial mandated script run exit1: FSRTv0.1.1 completed/zero, OpenGrep1.16.2 not_run because its default cache location was unwritable. Supported safe retry used only XDG_CACHE_HOME, SEMGREP_SETTINGS_FILE, SEMGREP_LOG_FILE and FORGE_SA_OUTPUT_DIR under ignored artifacts, without modifying skill fixtures/rules or HOME. Retry script exits0 and summary overall completed, but **coverage remains partial**:

- FSRTv0.1.1: completed, zero reported findings, `scanned:[""]`; file coverage indeterminate, not complete proof.
- OpenGrep1.16.2: completed_with_errors;61 listed paths,44 rules,4 leads (one ERROR/three WARNING), one partial parse error in `src/application/ports/logger.ts` at imported indexed field types. No source rewrite/suppression to satisfy parser.
- All four leads are false positives for Forge runtime reachability: e2e/src/auth.ts, cli.ts and private-files.ts use filesystem APIs in the isolated local harness; e2e/src/logs.ts imports child_process to run the fixed CLI read. None is imported by runtime/backend/UI entrypoints or resources. Reviewed exact `rce-code-execution.mdc`; no app command-injection finding follows from these imports. Harness filesystem/process capability remains subject to its own private-artifact safeguards.
- Snyk/gitleaks not installed/run. No hosted penetration test, native roles/expiry/revocation, real second installation, official new-artifact packaging or release licence acceptance performed. No scanner zero count is represented as security certification.

Raw scanner reports/JSON/SARIF/logs and graph outputs remain Git-ignored. No private session/credential/site/webtrigger file was read. Source changes arriving from other programme agents after this review need incremental security review before milestone acceptance.

## Exact follow-up

Continue independent approved local implementation. Lead integrates this assessment into the programme ledger. Before hosted v002/source/URL/HTTP work, obtain one consolidated decision on current18-package residual DEVELOPMENT risk and public-ingress/KVS exposure alongside fresh pending/usage/budget prerequisites in `docs/operations/sprint-2-hosted-acceptance.md`. Declining that native session blocks hosted intake acceptance, not unrelated local engineering. No release waiver or automatic deployment is proposed.

## Sprint 5 recovery reassessment — 2026-11-28

LH-014 remains OPEN. Fresh locked recovery install and standalone full/production audits each report12affected packages(5 high/7 moderate), same three ProseMirror/glob/minimatch advisory roots. Prior18-package/default-cache evidence remains conservative historical exposure evidence; lower counts do not demonstrate remediation. Root lock SHA25693077a48eaf451291acd6f79c0c712212807cd5446bd1f4329a42386fc578679 and direct versions unchanged: API 8.5.1,Bridge 7.4.0,Events 3.0.11,KVS 2.1.3,SQL 4.0.11,Resolver 2.0.2,React/ReactDOM 18.3.1. No force fix,override,downgrade or dependency/licence change. Existing synthetic DEVELOPMENT exception never grants staging/production or exact-new-artifact approval. Fresh full SAST/exploitability/hosted penetration testing was not performed; prior scanner gaps remain.

Missing temporary worktree directories caused unavailable unstaged POC/proposal edits; all committed implementation survives. Persistent recovery/sprint-5-poc worktree plus small reviewed commits mitigates recurrence. Existing refs/indexes/reflogs/private recovery material retained. No remote backup yet; reviewed branch publication should be prioritised only after owner approval. Private historical recovery must never be pushed. Installed light/dark/context/permissions/native enforcement and R-01–R-14/licence remain unverified/open; zero caller-visible projects does not prove no project exists. No application defect was confirmed by fresh 519-test validation; this is not production security approval.

## Readiness continuation — 2026-11-28

See [current exact-artifact composition reconciliation](dependency-security-assessment.md#remote-readiness-audit-reconciliation--2026-11-28) and [scanner coverage](sprint-5-remote-readiness-report.md#dependency-and-scanner-reconciliation). Four current audits agree12 affected names/three advisory leaves; the8→12historical difference is four added SDK parents, while18→12remains prior cache-sensitive inherited classification. LH-014 OPEN; no dependency edit or new DEVELOPMENT/staging/production waiver. Official exact-artifact reachability remains separate from local SDK-external graphs.
