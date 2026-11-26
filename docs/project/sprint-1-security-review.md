# Sprint 1 security and release-readiness review

Date: 2026-11-26. Scope: local implementation, manifest, direct/locked dependencies, frontend/backend boundaries and public-release files. This is not installed-runtime acceptance or a clean vulnerability certification.

## Execution map and controls

Custom UI invoke('inventory') → trusted resolver accountId/getAppContext → explicit application permission → tenant/installation-scoped SQL. Bootstrap/recovery and migration admission additionally use backend asUser Jira GLOBAL ADMINISTER permission. There are no asApp, public webtrigger, external fetch, secret-store, Rovo or directory endpoints. The async migration consumer accepts only a backend-queued installation binding and DEVELOPMENT runtime; production migration is refused.

Payload action/tenant/entity/record inputs are unknown and validated before sinks. Entity kinds/columns are code allowlists; values use prepare/bindParams. Same-tenant active references are checked under a complete durable ISP intent. Aggregate expected versions, pending intents and unique command/version receipts prevent stale writes and conflicting mutations until repair. Actor grants come from stored active/unexpired membership; teams/manual mapping cannot escalate access. Bootstrap is unavailable to the first arbitrary caller. Revoked grants are checked on subsequent requests; in-flight authorised work may finish.

React renders escaped text; unknown responses are validated before lists/tenant selection. No dangerouslySetInnerHTML, arbitrary URLs, client secrets or backend implementation imports occur in the UI. Error responses contain only a code and internally generated correlation ID. Structured failure logging receives only event/correlation/outcome; no payload, SQL parameters, membership record or raw exception message is logged.

## Findings and residual risks

No confirmed exploitable source finding remains from the scoped manual trace. The observed parent-retirement/child-creation race was fixed with durable tenant admission and a concurrent original/replay regression. This conclusion does not prove the absence of vulnerabilities.

| Severity                         | Source                                                                                                                 | Location / exact excerpt                                                              | Finding and disposition                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High concern                     | dependencies                                                                                                           | package-lock.json:4377, prosemirror-view; <pre><code>"version": "1.41.5"</code></pre> | Existing paste-handling XSS advisory. No editor/paste/HTML sink is implemented and no application exploit established; Sprint 1 needs a new risk disposition. |
| Moderate concern                 | dependencies                                                                                                           | package-lock.json:3231/3995; <pre><code>"version": "13.0.7"                           |
| "version": "10.2.6"</code></pre> | Existing glob/minimatch advisories now also reach API/SQL/Events via Manifest. Changed exposure requires owner review. |
| Warning                          | tests                                                                                                                  | tests/support/sqlite.ts:1; <pre><code>Local relational simulation ONLY.</code></pre>  | Adapted SQLite is not Forge SQL runtime, collation, concurrency or installation evidence.                                                                     |
| Warning                          | manifest                                                                                                               | manifest.yml:11/27; <pre><code>engine: mysql                                          |

- read:jira-work</code></pre> | Final lint has zero errors/warnings and one MAJOR_VERSION_RULE approval (exit 1). Upgrade authorisation and official packaging remain open. |
  | Info | resolver | src/application/inventory/service.ts:254; <pre><code>throw new InventoryError('REPAIR_REQUIRED');</code></pre> | Durable admission blocks later writes until an authorised administrator repairs pending work. No unsafe expiry. |

Dependency concerns are recorded with package paths/ranges and official GHSA links in dependency-security-assessment.md. They are not labelled new application exploit findings or assigned invented CVSS scores. Actual application exploitability and official artifact composition require further evidence.

## Coverage and evidence gaps

The installed builder, security-review, debugger, application-review and cost skills were read; hashes are recorded in the execution report. Security routing loaded the global baseline, authn/authz, injection, tenant isolation, auditing and miscellaneous indexes; deep checks covered resolver identity/authorisation, SQL injection and warm-state isolation. Secrets/egress/webtrigger/Rovo-specific indexes were not selected because no such runtime surface exists; manifest permissions and packaging were independently checked. Local tools remain ignored and are not app dependencies.

FSRT v0.1.1 exits 0 with zero reported findings but reports scanned=[""]; actual source coverage is unestablished and must not be called a clean FSRT source scan. OpenGrep 1.16.2 with the bundled Forge rules completed on the final source with zero findings/file errors across 33 source/config paths; the final run is recorded in audit. Its language/rule coverage does not include arbitrary JSON migration semantics, live permission configuration or tests. Gitleaks and Snyk were unavailable/not run. Staged-file secret/privacy review is separate; ignored artifacts are never proposed for commit.

Initial scanner attempts failed on sandbox cache writes; rerunning the pinned tools with normal cache access succeeded. Raw reports remain in ignored security-audit-artifacts and must not be published. No third-party fixture/rule was edited to produce a pass. Forge MCP and ADS MCP responded; exact official SQL/API/schema/query-policy/context/concurrency/pricing pages were consulted on 2026-11-26. A Forge MCP search briefly failed and guessed obsolete URLs were unavailable; the linked canonical pages replaced them.

## General application and cost review

Manifest page/resource/resolver/consumer exports match local builds and invoke names. Domain has no Forge imports; application ports do not import infrastructure; trusted runtime wiring stays in src/forge. All three new direct SDKs are pinned, their Atlassian licence files reviewed and supported Node 22 used. Local full backend graph contains 122 inputs and no affected leaves or tooling references; repeat official --inspect packaging review only under deployment authorisation. CI retains strict TypeScript, coverage gates, npm ci and no credentials/deploy steps.

No polling, schedules or migration-on-read exist. Lists are bounded/keyset paginated; reference/fixture/unique/reverse queries have tenant indexes. Seed batches cap at four records, reruns skip existing fixture rows and initial seed/rerun query budgets are tested. Migration retries cap at three executions per queued job. Exact SQL compute/GB-seconds and savings are unmeasured. Readiness: blocked for deployment/merge pending official major-upgrade approval, refreshed dependency disposition and live acceptance; local implementation is reviewable.
