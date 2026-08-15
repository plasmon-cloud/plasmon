# Luna-C r2 promotion audit — current release

**Audit release:** `origin/release/0.1.0-r2`

**Exact audited SHA:** `8cfb4d68414b271303bd0afefdcac9dc8449c315`

**TDD branch:** `tdd/r2/luna-c-apps` at `508ce2dc21f80950b2e2452d2d0cfa5c652e0f0a`.
The branch has unrelated staging drift from the current release (#191/#196,
#177, CI/browser-gate work); the target production files for #64/#89/#112/
#113/#114/#123/#124 are unchanged between the prior audited release and
`8cfb4d6`. #96 changed through integrated PR #264; no other implementation
branch was merged into this TDD lane.

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
| #64 | **NO VALID CORRECTIVE RED / FINALIZED** | `test/tdd/issue-64-progress-persistence-packet.md`; final `test/tdd/luna-c-r2-final-dispositions-current.md` | NO | current adapter still exposes only `JsDosPlayerHandle.stop()`; no save API to assert | none; SOL 1 product owner | future owner must add adapter save-result/restore tests after inspecting shipped js-dos 8.4.1 | terminal `[x]`; reopening trigger recorded |
| #89 | **RED NOT YET CONSUMED — HANDOFF SOL 1** | `test/tdd/issue-89-runtime-path-authority.md` plus route/package packets | YES | `test/tdd/.red/issue-89.red.test.ts`; created/proven in `8be3fa4d16759e2f18c5afd717f0c3b0d5e9c801` against base `3467309d2199beff40ba60dc8e5bf7ebe2164b26`; reproduced now against TDD HEAD with current release source | none; #131 is related #67 acceptance only | SOL 1 must preserve a permanent canonical-route/package assertion plus installed Worker URL/creation/communication proof | current test fails: `file:///.../text/monaco-workers/...` instead of `/System/Program Files/MonacoEditor/...`; no corrective PR in r2 |
| #96 | **GREEN IN R2 — HANDOFF SOL 2 COMPLETE** | current permanent `src/native-apps/issue-96.test.ts`; historical packet `test/tdd/issue-96-native-identity-assets-characterization.md` | YES — historical RED consumed | historical `test/tdd/.red/issue-96.red.test.ts` refreshed/proven in `eeb83f51ed7c56c2a996ab822cf57249276432c1`; current permanent test passes on release `8cfb4d6` | PR #264 (`fb6eba5`, `34a9e78`, `c6468e7`) merged into r2 | `apps/plasmon/src/native-apps/issue-96.test.ts`, `content-apps.test.ts`, #190 Visual tests, and installed `test/e2e/plasmon-presentation-assets.spec.ts` | 12 focused release tests GREEN; installed browser spec not executed in this audit |
| #112 | **ALREADY GREEN** | `test/tdd/issue-112-semantic-chrome-contract.md` and comparison packet | NO — architecture convergence has no valid implementation-independent RED | characterization only; no missing observable contract proven by Luna-C | none required | retain semantic roles/status/error/theme characterization if chrome changes | no implementation required; queue disposition remains GREEN |
| #113 | **BROWSER BOUNDARY / FINALIZED** | `test/tdd/issue-113-full-acceptance-matrix.md`; final `test/tdd/luna-c-r2-final-dispositions-current.md`; #200 packet | NO valid executable RTL RED | product gaps are code-inspected; canonical Happy DOM has no `CSS`/`CSS.escape` and real Monaco startup cannot mount | none; SOL 1 product owner | permanent semantic Text chrome tests plus packaged real-Monaco command/minimap proof after host contract | terminal `[x]`; exact shared RTL gap and reopening trigger recorded |
| #114 | **BROWSER BOUNDARY / FINALIZED** | `test/tdd/issue-114-full-acceptance-matrix.md`; final `test/tdd/luna-c-r2-final-dispositions-current.md`; #200 packet | NO valid executable RTL RED | formatter/commands are absent, preview sanitization is green; same `CSS.escape` Monaco mount failure | none; SOL 1 product owner | permanent formatter/error/command semantic tests and packaged editor interaction proof | terminal `[x]`; exact shared RTL gap and reopening trigger recorded |
| #123 | **NO VALID CORRECTIVE RED / FINALIZED** | `test/tdd/issue-123-game-artwork-red-spec.md`; final `test/tdd/luna-c-r2-final-dispositions-current.md` | NO | #190 shared presentation is integrated, but no accepted game-artwork metadata key/source/provenance/identity/size contract exists | none; SOL 2 product owner | after contract integration, add deterministic metadata-to-#190 presentation/fallback regression and bounded package proof | terminal `[x]`; product-contract reopening trigger recorded |
| #124 | **BLOCKED BY PRODUCT DEPENDENCY: #64 / FINALIZED** | `test/tdd/issue-124-save-screenshot-red-spec.md`; final `test/tdd/luna-c-r2-final-dispositions-current.md` | NO | #64 still has no authoritative save result, stable save resource identity, or explicit successful save boundary | SOL 1 after #64 | after #64, add save/preview independence, failure fallback, cleanup, and packaged capture/reopen regression | terminal `[x]`; #64 reopening trigger recorded |

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

### #96 — historical RED consumed in r2

The historical RED was consumed by PR #264. In a detached worktree at release
`8cfb4d68414b271303bd0afefdcac9dc8449c315`, the permanent regression command was
run with the existing dependency installation:

```text
cd /tmp/plasmon-r2-96/apps/plasmon && bun test \
  src/native-apps/issue-96.test.ts \
  src/native-apps/content-apps.test.ts \
  src/os/visual/issue-190.test.ts
```

Result: **12 pass, 0 fail**. `src/native-apps/issue-96.test.ts` now verifies all
six canonical metadata references are non-generated packaged assets and that
each referenced asset exists. The installed browser asset request proof is
`test/e2e/plasmon-presentation-assets.spec.ts`; it was not executed locally in
this promotion audit.

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

## Finalized TDD dispositions

The queue-finalization packet for #64/#113/#114/#123/#124 is
`apps/plasmon/test/tdd/luna-c-r2-final-dispositions-current.md`. Their queue
entries are finalized with terminal classifications; implementation blockers
remain explicitly recorded there and are not product completion claims.

#89 remains **RED NOT YET CONSUMED** and is handed to SOL 1. #96 is **GREEN IN
R2** after PR #264 and its permanent regression passes on the audited release.
