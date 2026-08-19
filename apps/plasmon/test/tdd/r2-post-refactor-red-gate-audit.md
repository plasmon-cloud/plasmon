# r2 post-refactor RED-gate / promotion audit

**Audit date:** 2026-08-18 16:31 UTC  
**Integrated authority:** `origin/release/0.1.0-r2` at `c047aa7391046dc28efc4d187f8871bb0de4afd2`  
**Scope:** the original 42-entry queue, historical RED/promotion ledgers, current release source/tests, current CI/quarantine inventory, and live r2 PR state.

This is a promotion audit, not an implementation claim. Historical Luna branches and staging `.red` files are not current product authority. The current release has no active TDD `.red` inventory; therefore `STILL RED` means “a current required gate is present and failing,” not “a historical RED once failed.”

## Result

| Classification | Count |
| --- | ---: |
| **TOTAL MEANINGFUL CONTRACTS** | **42** |
| **PERMANENT** | **15** |
| **EQUIVALENT** | **6** |
| **PACKAGED** | **7** |
| **QUARANTINED** | **3** |
| **MISSING** | **10** |
| **STILL RED** | **0** |
| **SUPERSEDED** | **1** |

“Permanent” means an ordinary discovered deterministic/RTL regression protects the original contract. “Packaged” means the contract is represented by a required installed/package/browser gate. “Quarantined” means the acceptance remains present but is excluded from normal required Specialist CI; it is not green coverage. Equivalent is reserved for a materially different but truthful authority-level guard, not merely a passing adjacent test.

## 42-entry disposition

| Issue | Classification | Current evidence and audit finding |
| --- | --- | --- |
| #44 | PERMANENT | `src/os/file-manager/create-shortcut.test.tsx` protects NodeId target identity, collision naming, selection, rename, and source preservation. |
| #51 | PERMANENT | Normal RTL `test/rtl/issue-51-send-to-desktop.test.tsx` plus `send-to-desktop.test.ts` are discovered by Fast CI; the old staging RED name is stale. |
| #65 | PERMANENT | Normal RTL `issue-65-operation-progress.test.tsx` and `operation-state.test.ts` protect import/paste pending state, mixed outcomes, alerts, duplicate suppression, and truthful item progress. |
| #66 | QUARANTINED | Real browser stacking/hit testing and directory-drop acceptance remains in `plasmon-drag-preview-66.spec.ts`, but `@r2-quarantine` excludes it; restoration is #320. |
| #86 | QUARANTINED | Real selection-range and post-dismissal drag acceptance remains in `plasmon-diagnostic-selection-86.spec.ts`, but is excluded; restoration is #330. |
| #92 | PERMANENT | `move-operation.test.ts`, operation state/presentation tests, and required RTL `issue-92.test.tsx` protect ordered partial move truth and UI lifecycle. |
| #93 | MISSING | `visual.components.test.tsx` protects `object-fit: contain`, but no current required packaged test proves decoded image rendered aspect geometry. The original visual contract is therefore not fully promoted. |
| #94 | MISSING | Current video tests prove MIME/capability/error and URL leases, not bounded frame extraction or FileManager video thumbnails. This is a missing product seam, not a harness failure. |
| #110 | PERMANENT | `preferences.test.ts` protects filesystem-backed persistence, reconstruction, canonical `includeHidden`, and no second filename policy. The visible toggle/reopen journey has no dedicated packaged gate, but the implemented deterministic contract is permanent. |
| #115 | MISSING | Existing command outcome tests do not prove the requested thin shared command authority is used by two real consumers. No source-shape substitute is valid; the Issue remains open. |
| #192 | PACKAGED | Deterministic controller tests are ordinary, and `plasmon-desktop-placement-192.spec.ts` is in required Smoke CI. The rendered placement boundary is therefore packaged, with lower permanent support. |
| #195 | EQUIVALENT | `issue-195.characterization.test.ts`, render-state tests, view strategies, RTL #196, and refactor smoke preserve refresh/selection/render authority without freezing component shape. They do not prove a private decomposition layout, which is not a truthful regression contract. |
| #61 | EQUIVALENT | Shell interaction tests protect click-away/flyout arbitration and context ownership through the current Shell authority. There is no standalone overlay-controller gate. |
| #63 | PERMANENT | `altTab.test.ts` and required RTL `issue-63-alt-tab.test.tsx` protect MRU/minimized/close reconciliation and the accessible keyboard adapter. Its separate packaged multi-instance acceptance is quarantined under #308. |
| #72 | PERMANENT | `taskbarPresentation.test.ts`, `taskbarMember.test.ts`, and Shell projection tests protect pinned/running/active/launching/uncertain state. |
| #87 | MISSING | Current tests cover fresh root placement and preservation, but the integrated release still lacks the provenance-backed migration path now proposed by open PR #340. A passing fresh case is not equivalent to the complete safe retirement contract. |
| #91 | PERMANENT | Required `test/issue-91-search-cap-safety.test.ts` proves ordinary category caps do not imply safety truncation while traversal truncation remains visible. |
| #109 | PERMANENT | Shared `PinIcon` artwork/state and Shell taskbar tests are ordinary discovered coverage. |
| #111 | MISSING | Shared primitives and #112 representative chrome tests exist, but no regression proves broad Shell visual-system convergence across Shell surfaces. |
| #117 | PERMANENT | Required `test/issue-117-window-placement.test.ts` proves Fs-backed placement survives close and production service recomposition. |
| #118 | PERMANENT | Taskbar model/member tests protect grouping and chooser policy. The installed chooser-title test remains quarantined under #303, so that browser companion is not permanent green evidence. |
| #119 | MISSING | Process close tests and app-local prompts exist, but there is no canonical native dialog/transient-window ownership contract or regression gate. |
| #38 | EQUIVALENT | Provider/storage/revision/share tests permanently protect the implemented Phase-A fail-closed boundary. Live MTN authorization/import remains an explicitly deferred external capability, not a lost Plasmon RED. |
| #58 | PACKAGED | Review model/persistence tests plus the required installed Review specialist acceptance protect the independent Review package/projection boundary. |
| #64 | PACKAGED | js-dos save lifecycle and progress tests are ordinary, and the broad required packaged demo-game journey protects save/reopen progress through the installed runtime. |
| #89 | PACKAGED | Package guards and Monaco environment tests protect Program Files authority; required `plasmon-monaco-workers-89.spec.ts` protects real worker/opaque-origin communication. |
| #96 | PACKAGED | Native identity package tests and required Smoke presentation-asset acceptance protect packaged first-party artwork and requests. |
| #112 | PERMANENT | Required RTL `issue-112-native-app-chrome.test.tsx` exercises real Text, Video, and Settings surfaces against shared chrome classes/semantics. |
| #113 | MISSING | Current title/language/command model tests and the required Monaco edit/save package journey are adjacent evidence, but no ordinary RTL/package assertion proves the complete Text chrome/status/affordance contract. The historical Happy-DOM harness-gap packet is no longer current authority; the permanent gate was not promoted. |
| #114 | MISSING | The current release has no permanent formatter/command-affordance regression; the implementation PR is still open (#338, based on the #113 branch). |
| #123 | PACKAGED | Artwork metadata/classification/visual tests are ordinary and the required demo-game package journey exercises the installed canonical artwork path. |
| #124 | QUARANTINED | Filesystem preview identity/bounds and FileManager thumbnail tests are permanent lower evidence, but the required `blob:` saved-preview browser assertion is excluded by #304. Restoration requires #304's documented five clean first attempts. |
| #78 | EQUIVALENT | Refactor guards and cross-surface shortcut/open tests protect stable identity and canonical activation, although there is no dedicated Issue-named lifecycle file. |
| #79 | PERMANENT | Required headless `issue-79-native-document-close-lifecycle.test.ts` covers Document, Process, Windowing, save/discard/cancel, and persistence semantics. |
| #81 | EQUIVALENT | Required RTL refactor smoke composes Search activation, Process, Windowing, minimize/restore, taskbar projection, and close. It is truthful composed coverage, but not the dedicated Issue-specific regression originally requested. |
| #82 | PERMANENT | Required `managedRootBootstrap.test.ts` protects idempotent roots, stable identities, projections, user state, and reconstruction. |
| #83 | EQUIVALENT | Headless EmulatorJS/js-dos association/runtime tests and required packaged runtime journeys protect the two routing outcomes, but no single composed Issue-specific selection test owns both. |
| #107 | PACKAGED | Required Smoke/Specialist/Persistence workflows and the complete inventory guard are permanent packaged infrastructure. The review baseline itself remains incomplete for packaged Delete/restore and Photos/Video rows; this is not a claim that every historical baseline row is green. |
| #25 | PERMANENT | Required `issue-25-legacy-gui2.test.ts` proves the active source tree and entrypoint no longer depend on `gui2`. |
| #26 | PERMANENT | Required `issue-26-legacy-platform.test.ts` proves the compatibility tree, consumers, and build references are removed. |
| #46 | SUPERSEDED | The canonical authority is Neutron Kernel capability. Plasmon exposes no uninstall behavior to test; the old Plasmon RED framing is not an applicable product contract and must not be replaced with fake UI semantics. |
| #100 | MISSING | The current release contains neither the historical `.red/issue-100.red.test.ts` nor a promoted ordinary metadata gate. The live semantic metadata problem is therefore an unprotected release-control gap, not `STILL RED` coverage. |

## Did the permanent net survive?

**Partially, but not completely.** The core reconstruction net is strong: canonical classification/presentation, NodeId identity, Desktop placement, FileEntry state, FileManager operation/strategy behavior, Search caps, Start/Search projection authorities, Process/Windowing lifecycle, taskbar projection/grouping, native chrome, and shared Monaco ownership all have ordinary lower-layer or required packaged protection.

However, the audit found **10 missing promotions**. The highest-risk loss is #100: its historical semantic RED gate disappeared entirely from the current release. Other gaps are incomplete acceptance promotions rather than absent product code: #87 migration provenance, #113/#114 editor affordances, #115 shared-command ownership, #111 Shell convergence, #119 transient ownership, #93 image geometry, #94 video thumbnails, and portions of #107's packaged baseline.

No current required test was found that is both present and failing, so `STILL RED = 0`; the missing contracts must not be relabeled green merely because adjacent tests pass.

## Promotion gaps, ordered by regression risk

1. **#100 dependency metadata:** the promoted semantic gate is absent from current source and normal CI; stale dependency sequencing can silently invalidate all downstream acceptance claims.
2. **Quarantined installed contracts:** #66/#320, #86/#330, and #124/#304 are excluded from required Specialist CI. In addition, packaged companions for #63/#308 and #118/#303 are excluded. These are retained tests, not permanent green protection.
3. **#87 Start retirement migration:** current release has fresh/preservation characterization but not the provenance-backed managed-folder migration now owned by open PR #340.
4. **#113 Text / #114 Markdown editor affordances:** current model tests and Monaco edit/save do not lock title, language, formatter, and command discoverability through the actual adapters; #338 remains open.
5. **#115 shared resource-command layer:** outcomes are tested, but the cross-consumer command seam is not protected.
6. **#107 packaged baseline completeness:** current required lanes are real and inventory-guarded, but the historical baseline's packaged Delete/restore and Photos/Video rows are not all represented.
7. **#93 image visual geometry:** `contain` is tested, but decoded rendered aspect behavior remains outside required package coverage.
8. **#111/#119 broad Shell and transient-window contracts:** representative tests do not establish the complete convergence/ownership invariants.

## Top product gaps

- Safe migration of a user-customized versus Shell-owned legacy Start `System` folder (#87).
- A canonical shared resource-command authority consumed by real FileManager surfaces (#115).
- Bounded video frame extraction/thumbnail lifecycle (#94).
- Complete Text/Markdown command and chrome parity (#113/#114).
- Explicit native dialog/transient ownership semantics (#119).
- Required packaged proof for decoded image geometry and the remaining #107 baseline rows (#93/#107).
- CI restoration of browser contracts that are currently flaky (#66, #86, #124, plus #63/#118 packaged journeys).

## Quarantined contracts

The current required Specialist inventory is present and filtered with `--grep-invert @r2-quarantine`; the inventory verifier passed and confirms the filter is narrow. Active test-level quarantines are:

| Acceptance | Restoration / repair Issue | Consequence |
| --- | --- | --- |
| Left-snap preview in `plasmon-golden-path-left-snap.spec.ts` | #279 (product context #277) | Not required while quarantined; #277 is outside the original 42. |
| Explorer sibling lifetime in `plasmon-golden-path-window-lifetime.spec.ts` | #251 | Setup cannot establish the second Explorer reliably. |
| Packaged Alt-Tab multi-instance acceptance in the same file | #308 (product #63) | Lower Alt-Tab RTL is permanent; this installed boundary is not. |
| Grouped Explorer chooser-title acceptance in `plasmon-review-demo.spec.ts` | #303 (product #118) | Lower grouping is permanent; first-attempt chooser readiness is not. |
| js-dos saved-preview `blob:` assertion in `plasmon-demo-game.spec.ts` | #304 (product #124) | Lower preview persistence is permanent; installed blob publication is not. |
| #66 drag-preview/directory-drop acceptance | #320 (product #66) | Preview stack/hit-testing and completion are not required together. |
| #86 diagnostic-selection acceptance | #330 (product #86) | Selection and post-dismissal drag are not required in Specialist CI. |

The exact BrowserHealth diagnostic quarantine for #305 is separate: only the full Chromium sandbox warning is allowed. It is not product green coverage. #268, #289, and #306 remain documented failure signatures rather than broad test skips. #244 and #245 are restored to required Specialist execution and are not active quarantines.

## Invalid or stale historical packets

- The one-file staging RED packets for #51 and #65, and the old #192 RED wording, are provenance only; ordinary current tests are the authority.
- The old #63 RED packet is superseded by current headless/RTL implementation coverage; only its packaged multi-instance companion remains quarantined.
- The historical #89 and #96 RED packets are superseded by current package guards and required installed acceptance.
- The prose-only #100 audit and staging `.red` gate were not promoted into the current release; do not treat the historical packet as current protection.
- The old #182 Favorites packet encoded test-local policy and is invalid; current `issue-182.test.ts` is not evidence for the original queue's missing promotion.
- The old #113/#114 Happy-DOM harness-gap packets no longer describe the post-#200/#113 production graph. They also do not prove that editor affordances were promoted.
- Historical browser parser/list output and unavailable local packaged sessions are operational evidence only, not browser execution. Merged PR CI evidence remains distinct from a fresh current-release run.
- Current source tests still containing labels such as `RED` (#189/#192) are passing ordinary tests; labels do not turn them into current RED gates.

## Recommended test-only follow-up work

1. Restore a narrow ordinary `test/ci` metadata dependency gate for #100, using the current GitHub dependency authority and required CI execution; preserve negative stale-edge cases.
2. Add permanent adapter-level tests for #113 Text title/language/command affordances and #114 Markdown formatter commands after #338's product merge; keep Monaco engine startup in the packaged lane.
3. Add a focused composed #115 command-consumer regression only after the product seam exists; do not use source-shape assertions.
4. Add the missing #87 managed-folder provenance migration cases to the ordinary Start reconciliation suite when #340 is integrated.
5. Add a narrow packaged #93 decoded-image geometry proof if product owners require it; retain lower `contain` tests and avoid duplicating classification semantics.
6. Complete a row-by-row packaged #107 report and add only narrowly scoped Delete/restore or Photos/Video specs where the baseline requires automation.
7. For each active quarantine, use its linked restoration Issue and the documented retries=0 clean-first-attempt criteria; do not delete tests or broaden BrowserHealth allowances.
8. Add a focused #119 contract only after ownership semantics are accepted by Process/Windowing; do not infer policy from current app-local close prompts.

## Evidence executed for this audit

From a detached worktree at the integrated SHA (not this TDD branch), the following passed:

```text
node test/ci/verify-plasmon-test-inventory.mjs
  Plasmon test inventory verified: fast=133, rtl=13, package=1, browser=19, nonPlasmonBrowser=13, excludedRed=0

node test/ci/verify-required-browser-gates.mjs
  Required r2 browser gate PR-always-run and unfiltered five-gate release-push contracts verified: smoke, browser, persistence

bun test apps/plasmon/src/os/shell/altTab.test.ts \
  apps/plasmon/test/issue-91-search-cap-safety.test.ts \
  apps/plasmon/test/issue-117-window-placement.test.ts \
  apps/plasmon/src/os/file-manager/issue-195.characterization.test.ts \
  apps/plasmon/src/native-apps/shared/monaco/hostContract.test.ts
  11 pass, 0 fail, 35 expect() calls
```

No packaged browser session was executed during this audit. Current live r2 ownership was checked at the same snapshot: open implementation PRs include #337 (Search geometry), #338 (Markdown affordances), #339 (visual cleanup), and #340 (Start retirement). No product code or other Luna branch was modified; the pre-existing unrelated worktree modification remains untouched.
