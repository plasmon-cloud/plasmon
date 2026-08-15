# Luna-C r2 promotion audit — current release

**Audit release:** `origin/release/0.1.0-r2`

**Exact audited SHA:** `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`

**TDD branch:** `tdd/r2/luna-c-apps` at `d1bc9d96c86921a87f91580e0c32d0299f25478c`.
The branch has unrelated staging drift from the current release (#191/#196,
#177, CI/browser-gate work); the target production files for #64/#89/#96/
#112/#113/#114/#123/#124 are unchanged between the prior audited release and
`56752dc`. No implementation branch was merged into this TDD lane.

**Ownership/PR audit:** GitHub Issues #64/#89/#96/#112/#113/#114/#123/#124
are open. No active implementation PR was found for those Issues. Related
merged PR #131 is the packaged Monaco acceptance for #67; it does not implement
#89, #113, or #114. Issue #38 remains coordinator-owned with closed Draft PR
#39 and outstanding backend/Neutron specialist evidence; Luna-C did not touch
it.

## Queue promotion matrix

| Issue | disposition | final packet path | intentional executable RED? | RED / evidence SHA | implementation PR/commit | permanent regression after implementation | current result / release |
|---|---|---|---|---|---|---|---|
| #38 | **CLAIMED / IN PROGRESS** | `test/tdd/review-sharing-boundary-audit.md` (cross-owner audit) | NO Luna-C RED | coordinator-owned PR #39 is closed; no integrated corrective implementation | none integrated; coordinator owns | coordinator/Neutron backend and specialist package/security evidence still required | not a Luna-C promotion candidate |
| #58 | **GREEN IN R2** | `test/tdd/issue-58-review-mvp-closure-audit.md` | NO — lower semantics were already characterized | no corrective RED; implementation PR #101 merged before current r2 | PR #101, integrated | `apps/review/test/{engine,persistence,validation,markdown,neutron_files_port}.test.ts`; installed `test/e2e/plasmon-review-demo.spec.ts` | 16 focused Review tests GREEN; browser not executed in this audit |
| #64 | **NO VALID CORRECTIVE RED** | `test/tdd/issue-64-progress-persistence-packet.md`; current re-audit `test/tdd/luna-c-current-r2-reaudit-64-113-114-123-124.md` | NO | current adapter still exposes only `JsDosPlayerHandle.stop()`; no save API to assert | none | future owner must add adapter save-result/restore tests after inspecting shipped js-dos 8.4.1 | production seam absent; remains `[~]` |
| #89 | **RED NOT YET CONSUMED — HANDOFF SOL 1** | `test/tdd/issue-89-runtime-path-authority.md` plus route/package packets | YES | `test/tdd/.red/issue-89.red.test.ts`; created/proven in `8be3fa4d16759e2f18c5afd717f0c3b0d5e9c801` against base `3467309d2199beff40ba60dc8e5bf7ebe2164b26`; reproduced now against TDD HEAD with current release source | none; #131 is related #67 acceptance only | SOL 1 must preserve a permanent canonical-route/package assertion plus installed Worker URL/creation/communication proof | current test fails: `file:///.../text/monaco-workers/...` instead of `/System/Program Files/MonacoEditor/...`; no corrective PR in r2 |
| #96 | **RED NOT YET CONSUMED — HANDOFF SOL 2** | `test/tdd/issue-96-native-identity-assets-characterization.md`; post-#190 reassessment | YES | `test/tdd/.red/issue-96.red.test.ts`; refreshed/proven in `eeb83f51ed7c56c2a996ab822cf57249276432c1` against base `3467309d2199beff40ba60dc8e5bf7ebe2164b26`; reproduced now against TDD HEAD with current release source | none | SOL 2 must retain metadata/package coverage for all six canonical refs, shared #190 fallback, and installed offline asset requests | current test fails on `native:text must not publish generated icon pixels`; generated data URIs remain in `content-apps.ts` |
| #112 | **ALREADY GREEN** | `test/tdd/issue-112-semantic-chrome-contract.md` and comparison packet | NO — architecture convergence has no valid implementation-independent RED | characterization only; no missing observable contract proven by Luna-C | none required | retain semantic roles/status/error/theme characterization if chrome changes | no implementation required; queue disposition remains GREEN |
| #113 | **HARNESS GAP** | `test/tdd/issue-113-full-acceptance-matrix.md`; #200 packet `test/tdd/issue-200-monaco-host-final-packet.md` | NO valid executable RED currently | no RED file; product gaps are code-inspected; canonical Happy DOM has no `CSS`/`CSS.escape` and real Monaco startup cannot mount | none; #131 only packaged base | implementor must add permanent semantic Text chrome tests and packaged real-Monaco command/minimap proof after shared adapter/host contract | remains `[~]`; exact shared RTL gap plus product/browser remainder |
| #114 | **HARNESS GAP** | `test/tdd/issue-114-full-acceptance-matrix.md`; #200 packet `test/tdd/issue-200-monaco-host-final-packet.md` | NO valid executable RED currently | no RED file; formatter/commands are absent, while preview sanitization is green; same `CSS.escape` Monaco mount failure | none; #131 only packaged base | implementor must add permanent formatter/error/command semantic tests and packaged editor interaction proof | remains `[~]`; exact shared RTL gap plus product/browser remainder |
| #123 | **NO VALID CORRECTIVE RED** | `test/tdd/issue-123-game-artwork-red-spec.md`; current re-audit packet | NO | #190 shared presentation is integrated, but no accepted game-artwork metadata key/source/provenance/identity/size contract exists | none | after contract integration, add deterministic metadata-to-#190 presentation/fallback regression and bounded package proof | remains `[~]`; product contract absent |
| #124 | **NO VALID CORRECTIVE RED** | `test/tdd/issue-124-save-screenshot-red-spec.md`; current re-audit packet | NO | #64 still has no authoritative save result, stable save resource identity, or explicit successful save boundary | none | after #64, add save/preview independence, failure fallback, cleanup, and packaged capture/reopen regression | remains `[~]`; dependency not integrated |

## Intentional RED promotion evidence

### #89 — RED NOT YET CONSUMED

Current failing command:

```text
cd apps/plasmon && bun test ./test/tdd/.red/issue-89.red.test.ts
```

Result: **0 pass, 1 fail**. The six intercepted Worker URLs resolve to
`file:///.../apps/plasmon/src/native-apps/text/monaco-workers/*.worker.js`
while the RED requires the canonical `/System/Program Files/MonacoEditor/`
route. This is a genuine deterministic adapter/path RED, not a browser-only
claim.

**PRESERVE:** label-to-worker mapping, module Worker semantics, logical Program
Files authority, no `MonacoEditor.sys`, document/model/session behavior, and
local-only package assets.

**CHANGE:** build/package transport and `monacoEnvironment.ts` route must use
the accepted canonical Monaco runtime path; retire active top-level assumptions.

**UNSPECIFIED:** whether the installed URL uses a documented package-local
mirror for browser serving, provided it is explicitly the transport for the
logical Program Files runtime and no second filesystem authority is created.

**Lowest truthful layer:** Bun for route selection and package tests for output;
Playwright for actual installed Worker construction, communication, opaque-origin
Firefox behavior, and strict browser health. No current Testing harness gap.

**Permanent regression required:** retain deterministic route/package assertions
in production/package tests and extend the merged #131/#67 installed journey to
observe Worker construction/communication and retire only the #89 allowances.

### #96 — RED NOT YET CONSUMED

Current failing command:

```text
cd apps/plasmon && bun test ./test/tdd/.red/issue-96.red.test.ts
```

Result: **0 pass, 1 fail**. The first canonical handler, `native:text`, still
publishes a generated `data:image/svg+xml` value from `content-apps.ts`.

**PRESERVE:** all handler/native IDs, associations, capabilities, accessibility
labels, #190's shared resolver/fallback, offline operation, and runtime-only
js-dos/EmulatorJS identity boundaries.

**CHANGE:** six first-party Text, Markdown, Photos, Video, Browser, and Settings
canonical identity references must become stable packaged asset references.

**UNSPECIFIED:** artwork pixels, visual dimensions, and surface-specific
presentation implementation. Provenance and offline package inclusion must be
recorded by the implementor without adding a second icon map.

**Lowest truthful layer:** Bun metadata identity and package-inventory tests;
installed package/HTTP proof for offline asset resolution; bounded manual visual
review only for appearance. No screenshot-pixel RED is valid.

**Permanent regression required:** move the RED intent into permanent
`content-apps` metadata coverage and package/offline asset checks, while keeping
#190's existing shared presentation regression intact.

## Implementing Sol handoffs

### SOL 1 — #89 Monaco canonical Program Files worker path

- **Final packet:** `apps/plasmon/test/tdd/issue-89-runtime-path-authority.md` plus `issue-89-package-file-inventory.md`, `issue-89-worker-route-table.md`, and `issue-67-worker-observability-v2.md`.
- **RED:** `apps/plasmon/test/tdd/.red/issue-89.red.test.ts`.
- **Reproduced against:** TDD HEAD `19860b27e78e93d88f4accb5767464fb7af545f5`, with target production source equal to audited `origin/release/0.1.0-r2` SHA `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`; original RED base `3467309d2199beff40ba60dc8e5bf7ebe2164b26`.
- **Failure:** six intercepted Worker URLs resolve under `text/monaco-workers/`; the assertion requires `/System/Program Files/MonacoEditor/{editor,ts,json,css,html}.worker.js` transport.
- **PRESERVE:** label routing, module Worker semantics, logical Program Files authority, no `MonacoEditor.sys`, document/model/session behavior, and local-only assets.
- **CHANGE:** build/package transport and `monacoEnvironment.ts` must consume the accepted canonical Monaco runtime route and retire active top-level assumptions.
- **UNSPECIFIED:** a documented package-local executable mirror is acceptable only as transport for the logical Program Files runtime; no second filesystem authority.
- **Permanent regression:** keep deterministic route/package assertions and add installed Chromium/Firefox Worker construction, communication, error, opaque-origin, and strict-health proof. Do not accept DOM readiness or HTTP 200 alone.

### SOL 2 — #96 packaged first-party identity assets

- **Final packet:** `apps/plasmon/test/tdd/issue-96-native-identity-assets-characterization.md` plus `issue-96-app-identity-asset-inventory.md` and `issue-96-post-190-reassessment.md`.
- **RED:** `apps/plasmon/test/tdd/.red/issue-96.red.test.ts`.
- **Reproduced against:** TDD HEAD `19860b27e78e93d88f4accb5767464fb7af545f5`, with target production source equal to audited `origin/release/0.1.0-r2` SHA `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`; original refreshed RED commit `eeb83f51ed7c56c2a996ab822cf57249276432c1` and base `3467309d2199beff40ba60dc8e5bf7ebe2164b26`.
- **Failure:** `native:text must not publish generated icon pixels`; `content-apps.ts` still publishes a generated `data:image/svg+xml` identity.
- **PRESERVE:** all handler/native IDs, associations, capabilities, semantic accessibility labels, #190 resolver/fallback, offline operation, and runtime-only js-dos/EmulatorJS boundaries.
- **CHANGE:** Text, Markdown, Photos, Video, Browser, and Settings canonical metadata must reference stable packaged offline identity assets.
- **UNSPECIFIED:** artwork pixels, dimensions, and surface-specific rendering. Provenance and package inclusion must be recorded without adding a second icon map.
- **Permanent regression:** retain metadata coverage for all six canonical references, package/offline asset inclusion and resolution, shared #190 fallback, and representative installed asset requests.

Neither handoff authorizes Luna-C production edits. Luna-C remains TDD/audit-only.

## Claimed `[~]` completion decision

- #64 remains `[~]`: missing production/runtime seam, no guessed API RED.
- #113/#114 remain `[~]`: canonical shared RTL harness cannot reach real Monaco;
  no local mock/polyfill and no fake RED.
- #123 remains `[~]`: product contract is still absent despite #190 integration.
- #124 remains `[~]`: dependency on #64 remains exact and unchanged.

No claimed item was falsely marked complete. The queue remains truthful: these
four entries are still pending their missing seam/contract, while #89/#96 are
explicitly flagged **RED NOT YET CONSUMED** rather than silently promoted.
