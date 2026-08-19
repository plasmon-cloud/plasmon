# Luna B post-refactor promotion audit

Audit target: `origin/release/0.1.0-r2`

Integrated source SHA inspected: `c047aa7391046dc28efc4d187f8871bb0de4afd2`.
Audit branch: `tdd/r2/luna-b-shell` (historical specification only).
Fetch and current-source inspection: `2026-08-18T16:31:07Z`.
Open-PR ownership check: `gh pr list --state open --search <Issue>` returned no open PR for each audited Lane-B Issue. The unrelated pre-existing worktree modification `packages/neutron-cli/src/index.ts` was not touched.

The current source was audited by `git show`/`git grep` against the release SHA. Focused current-release execution was performed in a detached temporary worktree (not this TDD branch):

- `bun test apps/plasmon/src/os/shell/altTab.test.ts apps/plasmon/test/issue-91-search-cap-safety.test.ts apps/plasmon/test/issue-117-window-placement.test.ts apps/plasmon/src/os/windowing/defaultPlacement.test.ts` — **PASS**, 10 tests / 41 assertions.
- `bun test --preload ./apps/plasmon/test/setupHappyDom.ts apps/plasmon/test/rtl/issue-63-alt-tab.test.tsx apps/plasmon/test/rtl/issue-176.test.tsx` — **PASS**, 6 tests / 28 assertions (React act warnings only).
- Browser files were inspected only; no packaged browser session was executed in this audit. Playwright listing/parser evidence is not counted as execution.

## Promotion matrix

| Issue | Original gate | Current protection | Classification | Evidence/path | Action |
|---|---|---|---|---|---|
| #61 | `.red/issue-61.characterization.ui.test.tsx` — one-owner Start/Search open, switch, outside-dismiss, Escape | Active RTL Start/Search semantic tests plus Shell dismissal/activation policy tests | **EQUIVALENT** | `apps/plasmon/test/rtl/renderPlasmon.test.tsx`; `apps/plasmon/src/os/shell/gate3.test.ts` | No promotion gap; current controller architecture supersedes the old whole-Shell characterization seam. |
| #63 | `.red/issue-63.red.ui.test.tsx` — Alt-Tab MRU focus and held-modifier switcher | Same two behavioral tests, plus canonical MRU/cycle/reconcile model tests | **PERMANENT** | `apps/plasmon/test/rtl/issue-63-alt-tab.test.tsx`; `apps/plasmon/src/os/shell/altTab.test.ts` | Keep active. |
| #63 | Packaged real-keyboard/focus adoption | Permanent packaged test exists but is excluded from required r2 Specialist execution | **QUARANTINED** | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` tagged `@r2-quarantine @issue-63 @issue-308` | Restore under **Issue #308**; the RTL/headless gate remains permanent. |
| #72 | Existing taskbar projection contract: pinned/running/active/launching/uncertain | Active pure projection and action tests | **PERMANENT** | `apps/plasmon/src/os/shell/taskbarPresentation.test.ts`, `taskbar.test.ts`, `shell.test.ts` | No action. |
| #81 | `.red/issue-81.composed.red.test.ts` — real Process/Windowing lifecycle through taskbar projection, dirty veto, stale cleanup | No composed current-r2 regression; only isolated projection/process tests remain | **MISSING** | `apps/plasmon/docs/ACCEPTANCE_2026-08-11_BASELINE_GATE.md` still says #81 is not yet testable; no `apps/plasmon/test/taskbarLifecycle.test.ts` in current tree | Add one shared-headless composition test. Test-only; no product defect indicated. |
| #87 | Start System retirement/preservation and idempotency | Active migration and runtime-only inventory tests | **PERMANENT** | `apps/plasmon/src/os/shell/startMenuSystemMigration.test.ts`, `gate3.test.ts`, `runtimeOnlyInventory.test.ts` | No action. |
| #88 | `.red/issue-88.characterization.test.ts` — runtime-only js-dos absent from launchable inventory | Production-backed current inventory/migration suite | **EQUIVALENT** | `apps/plasmon/src/os/shell/runtimeOnlyInventory.test.ts` | No action; stale `.red` import is not coverage. |
| #91 | `.red/issue-91.red.test.ts` — ordinary caps do not imply incomplete traversal; safety truncation remains visible | Exact current normal test, plus `capped`/`truncated` model assertions | **PERMANENT** | `apps/plasmon/test/issue-91-search-cap-safety.test.ts`; `apps/plasmon/src/os/shell/gate3.test.ts` | Keep active. |
| #109 | `.red/issue-109.characterization.ui.test.tsx` — shared PinIcon identity/state/labels and pin persistence | Active Visual component and real Start pin interaction tests | **EQUIVALENT** | `apps/plasmon/src/os/visual/visual.components.test.tsx`; `apps/plasmon/test/rtl/renderPlasmon.test.tsx`; `gate3.test.ts` | No action; visual appearance remains manual/package review, not invented source-shape coverage. |
| #111 | Shared visual primitive/token consumption characterization | Current shared Visual foundation and native-app/Shell consumers are covered | **EQUIVALENT** | `apps/plasmon/src/os/visual/issue-190.test.ts`, `visual.components.test.tsx`; `apps/plasmon/test/rtl/issue-112-native-app-chrome.test.tsx` | No action; do not reopen completed architecture cleanup. |
| #115 | Shared command characterization: bounded commands with real consumers | Canonical Start/Search activation and cross-surface production activation guards | **EQUIVALENT** | `apps/plasmon/src/os/shell/activation.test.ts`; `apps/plasmon/test/refactorGuards.test.ts` | No structural command test is justified by the characterization alone. |
| #117 | `.red/issue-117.red.test.ts` — moved placement survives close/recomposition | Current successor proves the same durable contract and waits at the real flush boundary | **EQUIVALENT** | `apps/plasmon/test/issue-117-window-placement.test.ts`; `apps/plasmon/src/os/windowing/placement.test.ts` | No action; the flush await is a required strengthening, not a lost gate. |
| #118 | `.red/issue-118.red.test.ts` — grouped app retains Process/Window member identities | Current grouping/member/presentation tests prove grouping and member targets | **EQUIVALENT** | `apps/plasmon/src/os/shell/taskbar.test.ts`, `taskbarMember.test.ts`, `taskbarPresentation.test.ts`, `shell.test.ts` | No headless promotion gap. |
| #118 | Packaged grouped chooser/context behavior | Browser proof exists but is quarantined | **QUARANTINED** | `test/e2e/plasmon-review-demo.spec.ts` test tagged `@r2-quarantine @issue-303` | Restore under **Issue #303**. |
| #119 | `issue-119.characterization.test.tsx` — do not fabricate native transient ownership | Later disposition selected app-local overlays and no concrete native transient consumer | **SUPERSEDED** | `apps/plasmon/test/tdd/issue-119-acceptance-map.md`; `apps/plasmon/src/native-apps/text/documentClose.test.ts` | Do not add a Windowing transient authority without a new concrete owner contract. |
| #176 | `.red/issue-176.red.ui.test.tsx` — editable and foreign context boundaries; specialized ownership | Current RTL successor contains the original boundaries plus Browser/Explorer cases | **PERMANENT** | `apps/plasmon/test/rtl/issue-176.test.tsx`; `apps/plasmon/src/os/context-menu-boundary.test.ts` | Keep active. |
| #176 | Real packaged context-menu propagation/iframe boundary | Required packaged context proof is active | **PACKAGED** | `test/e2e/plasmon-context-menu-176.spec.ts` | Execute in Specialist/package acceptance; no new RTL duplicate needed. |
| #177 | `.red/issue-177.red.test.ts` — bounded repeated default placement/wrap | Current Windowing placement suite is stronger and includes slot reuse, live wrap, and small viewport constraints | **EQUIVALENT** | `apps/plasmon/src/os/windowing/defaultPlacement.test.ts` | No action. |
| #177 | Packaged DOMRect reachability, resize, narrow-workspace controls | Active real-browser geometry/adaptor proof | **PACKAGED** | `test/e2e/plasmon-golden-path.spec.ts` (#199 geometry/reachability blocks) | Execute required packaged acceptance. |
| #177 | Repeated packaged sibling open/close lifetime adoption | Permanent browser test exists but is quarantined | **QUARANTINED** | `test/e2e/plasmon-golden-path-window-lifetime.spec.ts` tagged `@r2-quarantine @issue-251` | Restore under **Issue #251**. |
| #183 | `.red/issue-183.red.ui.test.tsx` and alignment RED — Close, Center, Left taskbar actions | Current packaged acceptance proves canonical Close and both alignment choices/geometry | **PACKAGED** | `test/e2e/plasmon-review-demo.spec.ts`; headless policy/persistence in `apps/plasmon/src/os/shell/taskbar.test.ts`, `interactions.test.ts`, `preferencesFs.test.ts` | Execute packaged acceptance; lower-layer policy is already permanent. |
| #184 | `.red/issue-184.red.test.ts` + `.red/issue-184.red.ui.test.tsx` — TaskManager.sys resource, canonical open, truthful process/window projection | Current source has no TaskManager native/system app or taskbar action | **STILL RED** | `git grep` at current SHA finds no TaskManager implementation/test; current `Shell.tsx` background menu remains Start/Search/Settings | Product implementation is unresolved; do not disguise it as a promotion gap. |
| #185 | `.red/issue-185.red.headless.test.ts` + `.red/issue-185.red.ui.test.tsx` — Show Desktop command/menu and affected-window restore semantics | Current WindowManager/Shell exposes no Show Desktop command or menu item | **STILL RED** | `git grep` at current SHA finds no `showDesktop`/`restoreDesktop`; no current acceptance test | Product implementation is unresolved; do not add a speculative test-only API. |
| #198 | `issue-198-refactor-red-packet.md` — grouping/member/menu projection | Current pure grouping, member, Close policy, placement, and alignment guards are active | **EQUIVALENT** | `apps/plasmon/src/os/shell/taskbar*.test.ts`, `interactions.test.ts`, `preferencesFs.test.ts` | No duplicate taskbar authority; retain current guards. |
| #198 | Packet-inherited composed Process/Windowing lifecycle contract (#81) | The inherited cross-authority regression was not promoted into current r2 | **MISSING** | `apps/plasmon/test/tdd/issue-198-refactor-red-packet.md` explicitly names `apps/plasmon/test/taskbarLifecycle.test.ts`; that file is absent at current SHA | Same smallest shared-headless test as #81; test-only. |
| #199 | `issue-199-refactor-red-packet.md` — deterministic manager geometry/placement/reachability | Current Windowing manager/geometry tests cover the deterministic contract | **EQUIVALENT** | `apps/plasmon/src/os/windowing/defaultPlacement.test.ts`, `interaction-reachability.test.ts`, `snap.test.ts`, `placement.test.ts` | No action. |
| #199 | Packaged focus, resize, viewport containment, titlebar/control reachability | Active required packaged browser coverage | **PACKAGED** | `test/e2e/plasmon-golden-path.spec.ts` | Execute required packaged acceptance; no fake DOM geometry. |
| #199 | Packaged snapped drag-out/pointer-relative continuity, including inherited #43 edge journeys | Permanent browser specs exist, but the left-edge journey is quarantined | **QUARANTINED** | `test/e2e/plasmon-golden-path-left-snap.spec.ts` tagged `@r2-quarantine @issue-277`; opposite-edge restoration is active under `@issue-244` | Restore the left-edge acceptance under **Issue #277**; preserve active #244 coverage. |
| #43 | Browser-only pointer-relative titlebar continuity after snap | Existing adoption spec is excluded from required r2 | **QUARANTINED** | `test/e2e/plasmon-golden-path-left-snap.spec.ts` (`@issue-277`) and active right-snap adoption (`@issue-244`) | Restore the complete left/right contract under **Issue #277**; no headless substitute is truthful. |

## Totals

- **PERMANENT:** 5
- **EQUIVALENT:** 10
- **PACKAGED:** 4
- **QUARANTINED:** 5
- **MISSING:** 2
- **STILL RED:** 2
- **SUPERSEDED:** 1

## PROMOTION GAPS

- **#81:** original gate `apps/plasmon/test/tdd/.red/issue-81.composed.red.test.ts`; contract is the real Process/Windowing taskbar lifecycle, dirty-close veto, and stale external-window cleanup. Truthful layer: **Bun/headless** through `createHeadlessPlasmonEnvironment()`. Smallest test: restore `apps/plasmon/test/taskbarLifecycle.test.ts` (or the current canonical test location) with pinned-only → active/inactive → minimized/restored → close plus veto and stale-window cases. This is test-only; current lifecycle authorities are present.
- **#198:** original packet `apps/plasmon/test/tdd/issue-198-refactor-red-packet.md`, which inherits the same #81 composed contract while requiring the taskbar to remain a Process/Windowing projection. Truthful layer: **Bun/headless**. The same smallest shared-headless lifecycle test closes this packet gap; this is also test-only and does not expose a product defect.

## PRODUCT GAPS

- **#184:** TaskManager.sys canonical resource/native activation and truthful Process/Window projection remain absent.
- **#185:** Show Desktop/restore command and taskbar menu action remain absent.

## QUARANTINED ACCEPTANCE

- **#63 packaged Alt-Tab/focus:** restore Issue **#308**.
- **#118 packaged grouped chooser/context:** restore Issue **#303**.
- **#177 repeated packaged sibling lifetime:** restore Issue **#251**.
- **#43/#199 left-edge snapped drag-out continuity:** restore Issue **#277**. The opposite-edge restoration acceptance is active under **#244**.

No stale `.red` file, Markdown matrix, audit note, Issue prose, or historical CI result was counted as current permanent coverage. Architecture work already represented by current tests was not reopened merely because its original staging file was not merged.
