# LH-014 dependency security assessment — 2026-11-25

Full and production-only audits both report **8 affected packages, 5 high / 3 moderate / 0 critical**. These are eight affected package names through three underlying advisories, not eight independent vulnerabilities. Both commands exit 1. Exact direct versions and package-lock.json remain unchanged; no supported compatible remediation is available in the currently published dependency ranges. No override, force fix or SDK downgrade was applied.

## Advisory evidence

Verified npm audit and official maintainer GitHub advisories on 2026-11-25:

- **A: [GHSA-c8x8-7fp4-3x9w](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w), CVE-2026-104847**, high: ProseMirror paste handling before 1.42.3; patch 1.42.3. Exploitation requires attacker HTML pasted into an editor.
- **B: [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), CVE-2026-118773**, moderate: glob >=9.0.0 <=14.0.1, patch 14.0.2. Aborted filesystem traversal continues consuming resources.
- **C: [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), CVE-2026-118764**, moderate: minimatch >=7.0.0 <11.0.1, patch 11.0.1. Attacker patterns with optimisation >=2 can amplify CPU/memory cost.

Path notation: root → Bridge means `light-house → @forge/bridge@7.4.0`. All listed affected packages are production-classified in the installed dependency tree; that classification does not establish runtime bundling. Ranges for wrapper packages are npm's inherited advisory ranges, not separate vulnerable function claims.

| Affected package / installed version                | Direct? / severity / advisory             | Audit affected range                                        | Dependency path from root                                   | Patched version / compatibility / disposition                                                                                                                                      |
| --------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| @forge/bridge 7.4.0                                 | Direct / high / A,B,C inherited           | 5.5.0-experimental-6de6b19 – 5.5.0-next.1 OR >=5.6.0-next.0 | root → Bridge                                               | Latest stable 7.4.0 still affected. Audit proposes 5.5.0 major downgrade, rejected as unverified compatibility/security remediation. Await supported SDK fix; no silent downgrade. |
| @atlaskit/adf-schema 56.7.3                         | Transitive / high / A inherited           | >=26.4.1                                                    | Bridge → adf-schema                                         | Bridge allows ^56.7.0; latest major 57.7.55 still uses affected editor 9.0.0. No verified fixed compatible parent release.                                                         |
| @atlaskit/adf-schema-generator 4.0.4                | Transitive / high / A inherited           | >=1.7.5                                                     | Bridge → adf-schema → generator                             | Uses ^9.0.0 editor; no verified parent fix; keep upstream contract.                                                                                                                |
| @atlaskit/editor-prosemirror 8.0.3 and nested 9.0.0 | Transitive / high / A inherited           | *                                                           | Bridge → adf-schema → editor 8; also → generator → editor 9 | All published 8.0.x and latest 9.0.0 pin view 1.41.5 exactly. Upgrading leaf to 1.42.3 violates pin; unsupported override deferred.                                                |
| prosemirror-view 1.41.5                             | Transitive / high / A                     | <1.42.3                                                     | Both editor paths above → view                              | 1.42.3 MIT; engine field absent in queried metadata. Patch exists, but parent exact pin prevents compatible leaf resolution; await Atlaskit/Bridge update.                         |
| @forge/manifest 13.9.1                              | Transitive / moderate / B,C inherited     | >=4.20.2-next.0                                             | Bridge → manifest                                           | Bridge pins 13.9.1 exactly, latest stable same. Depends on glob ^13.0.0; no verified supported fixed parent.                                                                       |
| glob 13.0.7                                         | Transitive / moderate / B and C inherited | 9.0.0 – 14.0.1                                              | Bridge → manifest → glob                                    | Patch 14.0.2, latest 14.0.6; BlueOak-1.0.0, Node 18/20/>=22. Manifest ^13 excludes major 14; latest 13 is 13.0.7. No supported compatible update.                                  |
| minimatch 10.2.6                                    | Transitive / moderate / C                 | 7.0.0 – 11.0.0                                              | Bridge → manifest → glob → minimatch                        | Patch 11.0.1; separate dev copies 11.0.9 are not affected. Glob ^10.2.2 excludes 11; overriding major unverified. Engine compatibility alone does not prove API compatibility.     |

Registry metadata queried using `npm view` for Bridge latest/dependencies/license, Manifest latest/dependencies, adf-schema latest/dependencies, editor 8.x and latest/dependency pin, glob 13.x and latest/engines/license, and patched view metadata. No dependency addition means no new engine/license acceptance is asserted. Existing proprietary Atlassian packages retain `SEE LICENSE IN LICENSE.txt`; exact lockfile integrity and supported Node 22.23.4 reviewed. React remains 18.3.1, resolver 2.0.2. Build/test tools remain as pinned in package.json; no new framework.

## Bundle and reachability evidence

A clean `npm ci` succeeded. Vite 8.3.8 was run with a temporary `generateBundle` inspection plugin that recorded every emitted chunk's module IDs and rendered lengths in `/tmp/light-house-ui-modules.json`. The built UI includes 66 Bridge modules (70,818 summed rendered module bytes), but **zero modules** from adf-schema, adf-schema-generator, either editor-prosemirror copy, prosemirror-view, manifest, glob or minimatch. The emitted iframe-resizer and main chunks are 29.18 kB and 205.25 kB. These counts are local production-build evidence, not npm package installation counts.

The backend esbuild smoke graph (`/tmp/light-house-backend-meta.json`) contains only the resolver entry/use case/metadata/logger/correlation code, with resolver externalised as configured. An additional fully bundled resolver graph checks that `@forge/resolver@2.0.2` has no runtime dependency on the affected chain. Bridge is not imported by backend code. Thus the known vulnerable leaf functionality is absent from the current locally built UI and backend graphs. The direct Bridge wrapper itself is emitted but its inherited vulnerable paths are not. Current UI has no editor/paste or filesystem-glob surface. No adversarial exploit test was simulated or claimed.

**Limit:** no app registration/deployment means the official Forge deployment artifact and installed runtime are unverified. The esbuild smoke artifact is not the Forge deploy artifact. The affected Manifest/glob tree is present in local installed tooling and may also occur in the isolated Forge CLI dependency tree, which is outside the application lockfile and not remediated by changing app dependencies. Trusted build/config inputs reduce exposure; they do not erase audit findings or prove all future packaging paths safe.

Per-path residual exposure: A is not reachable through the current emitted app graphs; adding an editor, rich text or changed Bridge exports requires reassessment before merge. B/C are not in those graphs and the status resolver accepts no filesystem patterns; local tooling processing untrusted repositories/manifests remains a risk. Wrapper findings inherit their leaf exposure and stay open. Never infer harmlessness from “transitive” or “production dependency” alone.

## Remediation and release gate

No compatible patch was applied because current latest supported parents pin vulnerable leaves/major ranges. A major override would require explicit rationale, upstream API/peer compatibility investigation, installation/build/runtime and editor/glob regression testing; the current scaffold cannot establish those guarantees. An audit-suggested old Bridge major is not a supported fix by assumption.

Mitigations: retain exact lockfile/`npm ci`, keep editor and attacker-controlled filesystem patterns absent, use trusted synthetic build inputs, keep evidence escaped and rerun graph/audits after SDK/import changes. These are exposure reductions, not upstream fixes. **LH-014 remains open and blocks deployment/release until a supported remediation or explicit owner disposition of this bounded residual risk is recorded.** No security waiver is implied. Recheck before the development smoke deployment and again before release. Audit failures remain visible and separate from passing lint/type/test/build gates.

## Reproduction

```sh
npm ci
npm audit --json
npm audit --omit=dev --json
npm ls @forge/bridge @forge/manifest @atlaskit/adf-schema @atlaskit/adf-schema-generator @atlaskit/editor-prosemirror prosemirror-view glob minimatch
npm view @forge/bridge version dependencies --json
npm view @forge/manifest version dependencies --json
npm view @atlaskit/editor-prosemirror version dependencies.prosemirror-view --json
npm run validate
```

Use Node from .nvmrc; in this sandbox use `npm --cache /tmp/light-house-npm` and the isolated tooling PATH recorded in audit.md. Raw audit JSON is retained in `/tmp/light-house-audit-final.json` and `/tmp/light-house-audit-prod-final.json` for this session; this document captures durable package/range/path/disposition evidence. Temporary evidence may disappear and must be regenerated at the next gate.
