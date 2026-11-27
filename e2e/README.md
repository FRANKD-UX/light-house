# Light House hosted DEVELOPMENT acceptance

This isolated TypeScript/Playwright workspace drives the **rendered** Light House Custom UI in the owner's approved Jira DEVELOPMENT installation. It does not mock Forge Bridge or call resolvers directly. Its read-only sequence runs health, overview/readiness v1, Lantern Fibre (admin), and sites/carriers/sla_tiers with next-page navigation when available. The expected deployed version is 3.3.0 from the deployment record; the UI's application version 0.1.0 does not independently identify a Forge deployment version.

## First use

From the repository root, on the owner's Linux/macOS desktop with Node 22.23.4/npm 10.9.9:

```sh
npm ci
npm ci --prefix e2e
export LIGHT_HOUSE_E2E_BROWSER_CHANNEL=chrome
npm run test:e2e:doctor
npm run test:e2e:auth
npm run test:e2e:development
npm run test:e2e:report
```

`test:e2e:doctor` checks the Node version, interactive terminal, owner-only directory creation, existing session metadata (never its contents), synthetic atomic writes, selected-channel resolution, and sandboxed headless/headed browser startup on local blank pages. It makes no Atlassian requests and does not replace a session. Each failed check names its stage, prints a fixed diagnostic/remedy and exits nonzero. A browser download alone does not establish Linux system dependencies or desktop access.

`test:e2e:auth` opens a fresh headed Chrome/Chromium context at the approved app URL. Complete normal Atlassian sign-in, SSO and MFA yourself in that browser. The harness never fills login fields, solves challenges, reads passwords or bypasses authentication. It waits up to ten minutes for the unique Light House iframe and then saves the session and closes the browser. Do not paste credentials into chat or terminal commands. If Atlassian denies the automated browser, stop and use the supported account/browser controls; do not disable those controls.

Keep the Forge tunnel stopped. The harness never starts/stops a tunnel, deploys, installs, migrates, seeds, repairs or saves data. Log in to the Forge CLI normally beforehand if hosted log collection is needed; no token/environment override is required. Do not run `forge login` inside this harness.

## Routine use

```sh
npm run test:e2e:development
# Same suite with a visible browser:
npm run test:e2e:development:headed
npm run test:e2e:report
```

Missing or expired authentication produces a blocked report and the exact `test:e2e:auth` follow-up. Reauthenticate only then (or when explicitly replacing the session). Other navigation/frame/permission failures are not automatically classified as expired authentication. No authentication retry loop runs. Authenticated browser launches explicitly enable Chromium sandboxing; the harness never adds an unsafe sandbox-disable workaround. A missing browser/display/system library is an external setup blocker, not application acceptance. Use installed Google Chrome Stable by default, or install the explicitly selected Chromium channel as described below; use Playwright's official [browser installation guidance](https://playwright.dev/docs/browsers) for platform dependencies. The harness does not install OS packages or weaken Chromium security options.

The app URL, environment and tenant label are pinned in `src/policy.ts`; command-line URL/environment overrides are rejected. Initial top-level navigation and each operation must remain at that exact approved app path. The backend-reported DEVELOPMENT/admin control is observed after tenant selection; it is never clicked. Extending the target requires a separately reviewed owner-approved code change. No staging or production target is supported.

## Evidence and interpretation

Each operation records UTC start/completion, monotonic duration, type/page, visible result, success/failure, row count and displayed record fields/lifecycle/version, backend code, displayed UUID and a fixed error category. The reader admits only sites/carriers `code`/`display_name` and tier `code`/`name`, plus row UUID/lifecycle/version. No tenant/account IDs or other table fields are copied. Failure-page rows, when readable, have `recordsFresh: false` and cannot establish the result of the failing request.

Before each click a DOM observer requires the status to transition through loading and completion; a prior generic completion cannot pass. A type change clears previous rows/cursors before the next first-page load. Empty success requires a fresh successful completion **and** a zero-row display/no-records state. Backend failures never become empty successes. Pages are read sequentially; IDs must increase without duplicates, and pagination is bounded to ten pages per type. Reaching the bound while another page exists fails acceptance rather than silently claiming complete traversal. No record count is assumed and no data is created to force pagination.

Reports are written even for missing-session/browser blockers:

- `e2e/.local/reports/acceptance.json`: curated machine-readable evidence.
- `e2e/.local/reports/acceptance.html`: static escaped HTML with a restrictive CSP, generated only from that evidence.
- Terminal summary: operation outcomes/counts/durations and correlation basis; no raw exception messages.

`test:e2e:report` verifies private report availability and prints their paths. Open the HTML file locally. `passed` refers to the UI suite, **not** a blanket Sprint 1 or hosted SQL diagnosis acceptance. The report separately records hosted-log availability and each match's completeness/basis.

After UI execution, the harness invokes the supported CLI from the repository root:

```sh
ATL_FORGE_ATTRIBUTION_SKILL_NAME=forge-debugger forge logs --environment development --since <report-start-UTC> --limit 1000 --grouped --non-interactive
```

Grouped CLI output can omit the date and expose only UTC time. The parser reconstructs a full timestamp only when the bounded `since`/collection interval supplies exactly one possible UTC date, labels `timestampBasis: unique-bounded-utc-date`, and rejects ambiguous dates; full CLI ISO timestamps have `timestampBasis: cli-full-utc`. No dates are taken from payloads. Only allowlisted JSON diagnostic/status fields with valid timestamp/UUIDs survive parsing; raw output is held in memory and discarded. Credential-store sandbox restrictions, CLI/network failures and missing/delayed events are recorded as limitations. If credential-store access is sandbox-blocked, use the supported execution escalation for **that read-only command**, never export/copy credentials. Hosted log propagation may lag; the command above can be rerun with the saved report start time without repeating UI operations. Do not publish raw CLI output. A future parser change requires local fixture tests against the actual CLI format.

Correlation basis is explicit:

- `displayed-uuid`: exact UUID equality with a fresh UI operation. Health exposes a UUID; inventory currently exposes one only on handled failure.
- `unique-time-candidate`: exactly one complete invocation falls within that operation's UTC interval, and no other operation claims it. This is temporal supporting evidence, not a UUID verified against the successful UI response. No clock-skew allowance is invented.
- `ambiguous`/`unmatched`: multiple candidates, reused candidates, missing stages, unknown format, clock skew or absent events prevent attribution. Never manufacture a match.
- `not-instrumented`: overview/selection/navigation have no list lifecycle UUID displayed.

`lifecycleComplete` requires success for resolver entry, SQL, mapping, response contract, serialization and completion, with no failure event. Events for SQL/provider error codes remain allowlisted. A successful same-sites read with complete hosted evidence supports the LIMIT diagnosis; no UI-only result or deployment proves why the earlier ER_WRONG_ARGUMENTS occurred. Other Sprint 1 isolation/repair/usage and persisted seed/intents/receipts gates remain separate.

## Authentication and artifact security

`e2e/.local/` is ignored by Git, ESLint and formatting; it contains credentials, never fixtures to commit. Session state uses `e2e/.local/auth/state.json`. Directories are 0700, files 0600, process umask 0077. Private storage rejects symlink directories, symlink reads, non-owner files, broad permissions and hard-linked reads; atomic writes replace rather than follow an existing link. Treat session state like credentials. Delete that file locally to forget the session; this does not revoke Atlassian's server session.

No screenshots, traces, videos, page/console/error dumps, HARs or persistent browser profiles are collected. This prevents Jira/login/MFA/headers/cookie capture rather than attempting to redact opaque binary traces afterward. Reports use field projection, token/email/URL redaction, bounded text and HTML escaping. Synthetic displayed records remain private evidence; inspect reports before any deliberate sharing. Do not add stock Playwright tracing/reporters that serialize raw page/network/test errors without a separate privacy review. Application logs and permissions are unchanged.

## Local engineering checks

```sh
npm run validate
npm run test:e2e:check
npm run test:e2e:fixture
npm audit --prefix e2e
```

`test:e2e:check` compiles strict TypeScript and runs Node behaviour/security tests without a browser or Atlassian credentials. CI runs this after a separate deterministic `npm ci --prefix e2e`. `test:e2e:fixture` uses Chromium and a synthetic local DOM to verify freshness, stale result rejection, empty success versus backend failure and safe record capture. It is **not** native Forge acceptance. Configure the selected browser first. Headed authentication/native acceptance are owner desktop gates, not required credential-bearing CI jobs.

The isolated pinned dev dependencies are @playwright/test 1.65.1 (Playwright/core 1.65.1, Apache-2.0, Node >=20), TypeScript 6.0.3 (Apache-2.0) and @types/node 22.20.5 (MIT). `e2e/package-lock.json` is committed; installed packages/browsers/build/auth/reports are not. The root application dependency lock is unchanged. Forge source/resource/build entrypoints do not import or package this workspace. Known application SDK advisory disposition remains separate from the isolated E2E audit.

Official references verified 2026-11-26: [authentication](https://playwright.dev/docs/auth), [frames](https://playwright.dev/docs/frames), [locators](https://playwright.dev/docs/locators), [auto-retrying assertions](https://playwright.dev/docs/test-assertions), [Forge CLI logs](https://developer.atlassian.com/platform/forge/cli-reference/logs/).

## Ubuntu authentication diagnostics — 2026-11-26

Run from a normal terminal inside the owner's logged-in graphical Ubuntu desktop, as the same non-root desktop user who owns this checkout. Input/output must remain attached to the terminal. Login, SSO and MFA happen only in the browser; there is no terminal credential prompt. The harness creates its private directories automatically, requires no pre-existing state or Forge token variable, and never asks you to set a guessed display variable. The selected headed Chromium-based browser uses X11/XWayland by default; a Wayland session needs working XWayland and its desktop-provided DISPLAY. A set DISPLAY is only a hint: the doctor actually launches a browser to check access. Do not use Xvfb as evidence that the owner can see and complete MFA.

| Fixed category                | Local action                                                                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BROWSER_EXECUTABLE_MISSING    | For `chrome`, ensure Google Chrome Stable is installed through the approved workstation process. For `chromium`, run `npm exec --prefix e2e -- playwright install chromium`; match PLAYWRIGHT_BROWSERS_PATH between install/run. No fallback. |
| BROWSER_DEPENDENCIES_MISSING  | Run `npm exec --prefix e2e -- playwright install-deps chromium` on Ubuntu; approve OS packages locally, then rerun doctor. The harness never installs them automatically.                                                                     |
| DISPLAY_UNAVAILABLE           | Use a terminal in the logged-in desktop with working X11/XWayland display access. Do not invent DISPLAY, expose the display with xhost, or bypass authentication.                                                                             |
| BROWSER_LAUNCH_FAILED         | Use installed Chrome Stable (`LIGHT_HOUSE_E2E_BROWSER_CHANNEL=chrome`) on this workstation. Keep sandboxing enabled; do not change AppArmor/kernel settings or run as root. Rerun doctor; a failed launch remains an external blocker.        |
| SESSION_DIRECTORY_FAILED      | Check that this checkout permits creation of e2e/.local/auth and contains no conflicting files/symlinks. Existing directories are not assumed.                                                                                                |
| SESSION_PERMISSION_DENIED     | Check local ownership; directories must be owner-only 700, state.json owner-only 600. Correct only the affected local paths as their owner; never share state or loosen permissions.                                                          |
| INTERACTIVE_TERMINAL_REQUIRED | Run auth directly from the desktop terminal without redirected input/output.                                                                                                                                                                  |
| AUTH_NAVIGATION_FAILED        | Check DNS, network, proxy and normal Atlassian browser access, then rerun auth. No certificate/authentication bypass.                                                                                                                         |
| AUTH_TIMEOUT                  | Complete login/SSO/MFA and wait for Light House within ten minutes; rerun auth if necessary. Missing app access or a closed browser can also prevent completion.                                                                              |
| SESSION_SAVE_FAILED           | Check free disk space and writable private storage; rerun doctor, then auth. Capture/write failure cannot replace the previous state before atomic rename.                                                                                    |
| LOCAL_PREREQUISITE_FAILED     | Use Node >=22.23.4 <23 and `npm ci --prefix e2e`; retry doctor. Unknown exceptions never print raw details.                                                                                                                                   |

The earlier generic error cannot retrospectively identify the owner's failing stage. In the agent environment, directory/write probes pass while sandboxed browser launches fail; this is separate from owner Ubuntu evidence. Owner installation success and compilation do not establish interactive authentication success. Only the corrected desktop auth followed by a fresh hosted report can close that gate.

After doctor passes, run `npm run test:e2e:auth`, then `npm run test:e2e:development` and `npm run test:e2e:report`. Reuse a valid session on routine runs. Share only the fixed failed check/category if blocked; never share session files, browser debugging output or cookies. Keep DEBUG/PWDEBUG browser logging disabled; this workflow collects no raw browser logs. No hosted acceptance is inferred from doctor or synthetic fixtures.

Official prerequisites verified 2026-11-26: [Playwright browser/system dependency installation](https://playwright.dev/docs/browsers), [Linux headed execution requirements](https://playwright.dev/docs/ci#running-headed).

## Browser channel selection — 2026-11-26

`LIGHT_HOUSE_E2E_BROWSER_CHANNEL` accepts exactly `chrome` (default, installed Google Chrome Stable) or `chromium` (Playwright-managed full Chromium, including its new headless mode). Empty/unknown values, executable paths and launch arguments fail with `BROWSER_CHANNEL_INVALID`; no fallback is attempted. `chrome` uses Playwright channel discovery rather than checking `chromium.executablePath()`, which points only to the downloaded browser. No absolute home path or personal Chrome profile is used. Authentication and hosted runs use fresh non-persistent contexts; only the private harness storage state is reused.

One configuration in `src/launch.ts` supplies channel, the requested headless mode, `chromiumSandbox: true` and a 30-second launch timeout. Doctor, interactive authentication, both hosted modes and the local synthetic fixture use it. Root execution is rejected with `BROWSER_ROOT_DENIED`. There are no caller-supplied launch arguments, sandbox overrides or retry paths. Do not use `--no-sandbox`, disable AppArmor, change namespace sysctls or use root. The owner confirmed downloaded Chromium fails with “No usable sandbox!” on Ubuntu 26.04.1 under restricted user namespaces; that evidence supports selecting installed Chrome Stable, but successful Chrome startup and native acceptance still require actual execution.

For developers or CI hosts that support sandboxed downloaded Chromium:

```sh
export LIGHT_HOUSE_E2E_BROWSER_CHANNEL=chromium
npm exec --prefix e2e -- playwright install chromium
npm run test:e2e:check
# Optional synthetic browser fixture on a non-root host with sandbox support:
npm run test:e2e:fixture
```

Credential-free CI logic checks require neither browser installation nor channel selection; they mock only the launch API in regression tests. Hosted acceptance remains an owner desktop gate. Do not use the Chromium choice on this workstation to bypass its confirmed startup restriction. For Chrome, no Playwright Chromium download is necessary. Keep the selected environment variable in the same terminal for doctor/auth/both hosted modes. Reuse an existing valid private session; run `test:e2e:auth` only when missing/expired.

Official channel and sandbox API references verified 2026-11-26: [browser channels](https://playwright.dev/docs/browsers#google-chrome--microsoft-edge), [launch options](https://playwright.dev/docs/api/class-browsertype#browser-type-launch). Channel support is an upstream API capability, not a claim of Ubuntu 26.04 certification or owner desktop success.

## Private target configuration

The repository contains only a synthetic example target for credential-free checks. Hosted auth/run commands first load the owner's exact approved target from ignored e2e/.local/approved-target.json (directory0700/file0600); no environment/CLI URL override or arbitrary fallback. The current target was transferred privately during checkpoint cleanup; no session contents were read. Preserve this file privately alongside the existing session. If absent/unsafe, hosted commands fail before browser launch; obtain the existing owner's approved target through the established private process, do not guess an installation or export cookies. The file contains url, environment DEVELOPMENT, deployedVersion3.3.0 and tenantLabel Lantern Fibre (admin). Real site/environment identifiers must never be committed. Synthetic fixtures/20 harness checks require no private target.
