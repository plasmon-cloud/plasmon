# Issue #481 — independent Luna-D RED-gate cross-check

Audit date: 2026-08-25. Target:
`origin/release/0.1.0-r2` at
`71f84fd2ad9bf43a4bd37d29e2122e597925ce9d`.

Prerequisites #478, #479, and #480 were verified **CLOSED** before this audit.
This report starts from the historical A/B/C/D staging material and then checks
current release source, current executable tests, current required CI gates,
quarantine inventory, and live Issues/PRs. No product code, Luna manifest,
registry, verifier, parser, or Luna-specific CI was added.

## Independent outcome vocabulary

- **PROVEN_CURRENT:** current production behavior has exact executable evidence.
- **OPEN_WORK:** an in-scope contract is incomplete and has one canonical normal Issue owner.
- **INVALID_RED:** the historical gate asserted a wrong API, role, architecture, or test-only seam.
- **OUT_OF_R2:** valid work intentionally remains in an ordinary future/out-of-r2 Issue.

A browser gate that is present but quarantined is not promoted to current green;
its restoration Issue is recorded. Games/heavyweight runtime delivery is not
restored to the required r2 profile merely because historical Luna material
contains game gates.

## Historical contract cross-check

The table covers the unique historical A/B/C/D RED and boundary contracts. Rows
with two layers (deterministic plus packaged/browser) are intentionally split.

| Area / gate | D independent disposition | Exact current evidence / canonical Issue | Mismatch with A/B/C? |
|---|---|---|---|
| A #44 shortcut lifecycle | PROVEN_CURRENT | `src/os/file-manager/create-shortcut.test.tsx`, `src/os/fs/desktopCore.test.ts`, packaged `plasmon-create-shortcut-44.spec.ts` | no |
| A #51 Send to Desktop | PROVEN_CURRENT | `send-to-desktop.test.ts`, RTL #51, packaged #51 spec; PR #358/merged train | no |
| A #52 shared FileEntry presentation | PROVEN_CURRENT | shared Visual/resource presentation tests and packaged presentation assets; delegated to #190 | no |
| A #65 import/paste visible progress | OPEN_WORK | ordinary state/RTL tests pass, but the live Issue still owns missing packaged/manual visible-progress acceptance; canonical Issue #65 | no |
| A #66 drag preview/drop | PROVEN_CURRENT | current `plasmon-drag-preview-66.spec.ts`; #320 restoration completed; required Browser CI evidence | no |
| A #78 cross-surface shortcut lifecycle | PROVEN_CURRENT | cross-surface activation/refactor guards and lifecycle equivalent tests | no |
| A #82 managed-root bootstrap | PROVEN_CURRENT | `managedRootBootstrap.test.ts`, default-seed/DesktopCore/refactor guards | no |
| A #86 diagnostic selection/no stolen drag | PROVEN_CURRENT | current `plasmon-diagnostic-selection-86.spec.ts`; #330 restoration evidence; required Browser CI | no |
| A #92 drag-move operation lifecycle | PROVEN_CURRENT | move-operation, operation-state/presentation, RTL #92 | no |
| A #93 image thumbnail containment | PROVEN_CURRENT | `resource-thumbnail.test.ts`, RTL lifecycle, packaged `plasmon-thumbnail-aspect-93.spec.ts` and fixtures | no; stale A material was superseded by PR #357 |
| A #94 bounded video thumbnail | OPEN_WORK | no accepted frame-probe/thumbnail production seam; canonical Issue #94 | no |
| A #95 selected-label geometry | PROVEN_CURRENT | current golden-path #95 journey and desktop-label tests | no |
| A #108 Explorer navigation | PROVEN_CURRENT | Explorer navigation model tests and current golden path | no |
| A #110 hidden-file preference | PROVEN_CURRENT | Fs-backed preference tests and packaged `plasmon-hidden-preference-110.spec.ts`; PR #352 | no; stale A gap was superseded |
| A #115 shared command layer | OPEN_WORK | current outcomes are covered, but the Issue's real two-consumer command seam remains unproven; canonical Issue #115 | no |
| A #169 Start reconciliation | PROVEN_CURRENT | `startMenuReconciliation169.test.ts` and merged PR #221 evidence | no |
| A #171 installed icon request budget | PROVEN_CURRENT | resolver/concurrency tests and packaged presentation asset request budget | no |
| A #172 Trash/placement composition | PROVEN_CURRENT | Desktop layout/placement, Trash lifecycle, and #192 packaged guards | no |
| A #173 List strategy/geometry | PROVEN_CURRENT | view/spatial strategy tests and packaged List spec | no |
| A #174 canonical Search projection | PROVEN_CURRENT | Search projection/activation/classification tests and #366 regression | no |
| A #175 Search geometry | PROVEN_CURRENT | packaged `plasmon-search-geometry-175.spec.ts`; merged PR #337 | no; stale c047 audit was superseded |
| A #176 context-menu ownership | PROVEN_CURRENT | context boundary Bun/RTL and packaged #176 spec; merged PR #235 | no |
| A #178 classification precedence | PROVEN_CURRENT | canonical #189 classifier/consumer tests; old cast/API RED invalid | no |
| A #182 root/Favorites deletion persistence | OPEN_WORK | fresh/preservation tests exist, but rename → intentional delete → recomposition non-resurrection is still missing; canonical Issue #367 | no |
| A #189 classification authority | PROVEN_CURRENT | `test/refactor/189/issue-189.test.ts` and current consumers | no |
| A #190 presentation/assets | PROVEN_CURRENT | Visual tests and strict packaged asset/request acceptance | no |
| A #191 FileEntry pilot | PROVEN_CURRENT | FileEntry characterization/RTL and packaged geometry | no |
| A #192 Desktop placement | PROVEN_CURRENT | Desktop placement/layout tests and packaged #192 | no |
| A #193 Search surface | PROVEN_CURRENT | Search surface state/RTL/packaged golden-path evidence; #175 separate and proven | no |
| A #194 Start surface | PROVEN_CURRENT | Start controller/state/RTL and packaged Start journey | no |
| A #195 FileManager decomposition | PROVEN_CURRENT | current FileManager characterization/render-state/strategy guards; PR #213 | no |
| A #196 view strategies | PROVEN_CURRENT | view strategy Bun/RTL and packaged List evidence | no |
| A #197 Shell decomposition packet | INVALID_RED | handoff/source-shape architecture packet, not an independent executable behavior RED; current Shell tests belong to B-owned contracts | no |
| A #201 migration cleanup | OPEN_WORK | cleanup remains ordinary active PR/Issue-owned work; no historical executable RED is falsely promoted | no |
| B #61 Shell flyout characterization | PROVEN_CURRENT | Shell coordination tests and current RTL composition | no |
| B #63 Alt-Tab deterministic/RTL | PROVEN_CURRENT | `altTab.test.ts`, RTL #63; merged PR #266 | no |
| B #63 packaged keyboard/multi-instance boundary | OPEN_WORK | test remains quarantined under canonical #308; lower contract is green, required real-keyboard restoration is not yet proven | no |
| B #72 taskbar projection | PROVEN_CURRENT | taskbar/taskbarPresentation/shell tests and packaged #72 | no |
| B #81 composed taskbar lifecycle | PROVEN_CURRENT | `apps/plasmon/test/taskbarLifecycle.test.ts` from merged PR #473 | no; stale pre-#473 audit corrected |
| B #87 Start migration/idempotency | PROVEN_CURRENT | Start migration/provenance/gate3 tests | no |
| B #88 runtime-only inventory | PROVEN_CURRENT | `runtimeOnlyInventory.test.ts` adopted equivalent | no |
| B #91 Search cap versus safety truncation | PROVEN_CURRENT | current `issue-91-search-cap-safety.test.ts`; merged PR #276 | no; stale pre-#276 audit corrected |
| B #109 pin presentation | PROVEN_CURRENT | Visual/pin tests and packaged #109 | no |
| B #111 broad Shell visual convergence | OPEN_WORK | current Issue #111 remains RELEASE_OPEN; representative Visual tests do not prove broad Shell token/primitive convergence | **yes — B's equivalent disposition was too strong** |
| B #117 placement persistence | PROVEN_CURRENT | placement model and `test/issue-117-window-placement.test.ts` | no |
| B #118 grouping/member identity | PROVEN_CURRENT | taskbar/member/presentation tests; #303 browser restoration completed | no |
| B #119 native transient ownership | OPEN_WORK | app-local close prompts are proven, but the actual native transient owner/parent contract remains unimplemented; canonical Issue #119 | no |
| B #177 bounded placement | PROVEN_CURRENT | default placement/reachability tests and packaged geometry evidence | no |
| B #183 taskbar Close/alignment | PROVEN_CURRENT | taskbar policy tests and packaged Review-demo acceptance | no |
| B #184 TaskManager.sys | OUT_OF_R2 | canonical Issue #184 is milestone `0.1.0-r3`; no r2 implementation is required | no |
| B #185 Show Desktop | OUT_OF_R2 | canonical Issue #185 is milestone `0.1.0-r3`; no r2 implementation is required | no |
| B #198 taskbar reconstruction | PROVEN_CURRENT | current taskbar grouping/member/policy tests and merged PR #256 | no |
| B #199 NativeWindow reconstruction | PROVEN_CURRENT | Windowing geometry/interaction tests and current packaged geometry graph | no |
| B #43 snapped drag-out boundary | PROVEN_CURRENT | current left/right snap restoration graph; any remaining flake is owned by ordinary CI Issues | no |
| C #48 EmulatorJS second runtime | OUT_OF_R2 | heavyweight game/runtime delivery is outside the required r2 profile; preserve ordinary future/runtime evidence | no |
| C #58 Review MVP | PROVEN_CURRENT | Review engine/persistence/validation/Markdown tests and packaged Review workflow | no |
| C #64 js-dos save/progress | OUT_OF_R2 | historical heavyweight game runtime delivery is outside required r2; current bounded optional evidence is not a required r2 gate | no |
| C #67 packaged Monaco base | PROVEN_CURRENT | packaged Monaco editor/worker acceptance graph; #89 route now integrated | no |
| C #79 document close | PROVEN_CURRENT | current headless document/process/window close tests | no |
| C #83 runtime association selection | PROVEN_CURRENT | association/open composition and runtime tests | no |
| C #89 Monaco Program Files route | PROVEN_CURRENT | current route/package tests and merged PR #265; worker browser acceptance remains quarantined under #391 | no |
| C #96 native identity assets | PROVEN_CURRENT | `src/native-apps/issue-96.test.ts`, package assets and merged PR #264 | no; stale C no-PR result corrected |
| C #107 packaged baseline | PROVEN_CURRENT | current inventory verifier, smoke/specialist/persistence workflows and BrowserHealth | no |
| C #112 native-app chrome | PROVEN_CURRENT | current RTL chrome test and native app Visual coverage | no |
| C #113 Text Monaco parity | PROVEN_CURRENT | `test/e2e/plasmon-text-parity-344.spec.ts`; merged #344-era implementation and current release | **yes — C called this MISSING after the proof landed** |
| C #114 Markdown formatter/commands | PROVEN_CURRENT | `test/e2e/plasmon-markdown-commands-114.spec.ts`; merged #338/#417 train | **yes — C called this STILL RED after the proof landed** |
| C #121 explicit game fixture | OUT_OF_R2 | heavyweight game fixture delivery is outside required r2 profile | no |
| C #122 games UX research matrix | INVALID_RED | research/reference material is not a normative executable product contract | no |
| C #123 game artwork | OUT_OF_R2 | game/heavyweight delivery remains outside required r2 profile; current optional tests are not a required r2 gate | no |
| C #124 saved-preview blob gate | OUT_OF_R2 | valid future game-preview work; current lower implementation exists but `@r2-quarantine @issue-124 @issue-304` remains outside required r2 promotion | no |
| C #170 Review first-demo quality | PROVEN_CURRENT | Review packaged workflow/e2e | no |
| C #179 autosave opt-in | PROVEN_CURRENT | DocumentSession autosave tests | no |
| C #180 denied-fullscreen Photos | PROVEN_CURRENT | `test/e2e/plasmon-photos-expand-180.spec.ts`; merged PR #472 | **yes — C called this MISSING after the proof landed** |
| C #187 strict refactor/browser health | PROVEN_CURRENT | refactor guards, BrowserHealth, inventory and required CI | no |
| C #200 shared Monaco host | PROVEN_CURRENT | shared host policy/contract tests and packaged Monaco graph | no |
| C #202 js-dos storage bootstrap | OUT_OF_R2 | heavyweight game/runtime delivery is outside required r2 profile; retain future evidence without restoring required r2 delivery | no |
| D #25 gui2 retirement | PROVEN_CURRENT | current release has no `src/gui2`; permanent `test/issue-25-legacy-gui2.test.ts` | no; D's old snapshot was stale |
| D #26 platform retirement | PROVEN_CURRENT | current release has no `src/platform`; permanent `test/issue-26-legacy-platform.test.ts` | no; D's old snapshot was stale |
| D #100 native dependency metadata | OPEN_WORK | historical semantic gate is not in ordinary current discovery; canonical Issue #100 remains open/blocked with explicit `/triage` and native-GitHub dependency capability owner | no |
| D #167 shared harness | PROVEN_CURRENT | current headless/RTL/package/browser harness and merged harness CI | no |
| D #186 persistence boundary | PROVEN_CURRENT | current packaged persistence lane and merged PR #209 | no |
| D #38 Sharing Phase-A/provider boundary | OUT_OF_R2 | Issue #38 is now milestone `0.1.0-r3`; current provider/storage tests prove implemented Phase A, while live MTN remains external/fail-closed | no |

## Corrections made to A/B/C

1. Added an independent correction comment to #480: #113, #114, and #180 are
   current packaged proofs, not MISSING/STILL RED. Also recorded current #89,
   #96, #93, #110, #175, and #81 promotion evidence.
2. Corrected the stale B #111 conclusion: current release evidence proves
   representative Visual use, but the live broad convergence contract remains
   OPEN_WORK under canonical Issue #111. No duplicate Issue was created.
3. Corrected stale pre-PR conclusions for #81, #91, #93, #96, #110, #113,
   #114, #175, and #180 using current release files and merged PR history.
4. Routed historical heavyweight game/runtime gates (#48, #64, #121, #123,
   #124, #202) as OUT_OF_R2 for the required r2 profile; no game payload or
   Luna gate was restored.
5. Retained #65, #94, #100, #111, #115, #119, and #367 as normal canonical
   OPEN_WORK owners. No duplicate Issues were created.

## Normal release validation

At audited release `71f84fd`, GitHub reports successful current release checks:

- Fast Bun tests: success
- Packaged browser persistence: success
- Packaged Playwright specialist acceptance: success
- Packaged refactor smoke: success
- Kernel and applicability checks: success

The current inventory/quarantine system is strict: required Specialist runs use
`--grep-invert @r2-quarantine`; unknown failures and BrowserHealth failures
remain hard failures. Active quarantines are narrow and linked to ordinary
repair Issues (#251, #304, #308, #371/#406, #391, #415/#434). #66/#86 and #118
restorations are no longer quarantined. No local browser/manual session was
claimed; the current release CI evidence is the normal release evidence.

## Final standard

No in-scope historical RED was found that is both genuinely incomplete and
unowned. Remaining r2 work has canonical ordinary owners (#65, #94, #100,
#111, #115, #119, #367 and linked CI restoration Issues). Out-of-r2 valid work
is routed to existing ordinary future Issues. No Luna-specific implementation
or CI artifact is required.
