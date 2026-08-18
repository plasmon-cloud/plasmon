# Luna A post-refactor promotion audit

Audit timestamp: 2026-08-18T16:31:00Z  
Integrated source inspected: `origin/release/0.1.0-r2` at
`c047aa7391046dc28efc4d187f8871bb0de4afd2`  
Branch: `tdd/r2/luna-a-desktop`

This audit compares the historical Luna-A packets with the current integrated
release. Historical `.red` files, packet prose, and audit matrices are not
counted as current protection. The current source was inspected in detached
worktree `/tmp/plasmon-current-r2-audit`. Open-PR ownership was checked after
fetch: #175 remains actively owned by PR #337 (`work/bug/issue175`) and #201 by
PR #339 (`work/task/issue201`); neither branch was inspected as current source
or modified.

## Promotion table

| Issue | Original gate | Current protection | Classification | Evidence/path | Action |
|---|---|---|---|---|---|
| #44 | `issue-44-closure-audit.md`; canonical Create Shortcut lifecycle | Active headless production-graph shortcut tests cover NodeId metadata, collisions, selection, rename/move | **PERMANENT** | `src/os/file-manager/create-shortcut.test.tsx`, `src/os/fs/desktopCore.test.ts`, `test/fileManagerActivation.test.ts` | None |
| #45 | `issue-45-closure-audit.md`; native Recycle Bin launch/render and Trash lifecycle | Current required packaged golden path launches and renders Recycle Bin; Bun model/Trash tests cover authority semantics | **PACKAGED** | `test/e2e/plasmon-golden-path.spec.ts`; `src/native-apps/recycle-bin/model.test.ts`; `test/trashLifecycle.test.ts` | None |
| #51 | `.red/issue-51.red.ui.test.tsx`; selected resource Send to Desktop | Current normal RTL and headless tests create canonical NodeId shortcut without moving source and cover collisions/errors | **PERMANENT** | `test/rtl/issue-51-send-to-desktop.test.tsx`; `src/os/file-manager/send-to-desktop.test.ts` | None |
| #65 | `.red/issue-65.red.ui.test.tsx`; import/paste accessible running state | Current normal RTL tests hold real production import/copy operations pending and assert running/completed state | **PERMANENT** | `test/rtl/issue-65-operation-progress.test.tsx`; `src/os/file-manager/operation-{state,presentation}.test.ts` | None |
| #66 | `test/e2e/plasmon-drag-preview-66.red.spec.ts`; multi-selection preview, stack/hit testing, cleanup, drop | Exact repaired browser acceptance is present, but excluded from required Specialist execution by the canonical quarantine tag | **QUARANTINED** | `test/e2e/plasmon-drag-preview-66.spec.ts`; `test/ci/QUARANTINED_BROWSER_TESTS.md` | Restore through **#320**; do not remove the quarantine without its five clean unquarantined runs |
| #78 | `issue-78.lifecycle.test.ts`; create/rename/move/open shortcut lifecycle across surfaces | Current composed refactor/lifecycle tests prove the same NodeId and canonical activation outcomes through current production composition | **EQUIVALENT** | `test/refactorGuards.test.ts`, `test/resourceOpenCrossSurface.test.ts`, `test/fileManagerActivation.test.ts` | None |
| #82 | `issue-82-closure-audit.md`; managed-root bootstrap idempotence, repair, preservation and projection boundaries | Current managed-root, seed, desktop-core and refactor-guard tests exercise the production graph | **EQUIVALENT** | `test/managedRootBootstrap.test.ts`, `src/os/fs/{defaultSeeds,desktopCore}.test.ts`, `test/refactorGuards.test.ts` | None |
| #86 | `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts`; selectable diagnostics without stealing FileEntry drag | Exact browser acceptance is present, but excluded from required Specialist execution by the canonical quarantine tag | **QUARANTINED** | `test/e2e/plasmon-diagnostic-selection-86.spec.ts`; `test/ci/QUARANTINED_BROWSER_TESTS.md` | Restore through **#330**; preserve text-selection, no-stolen-drag, and post-dismissal drag assertions |
| #92 | `.red/issue-92.red.ui.test.tsx`; multi-item drag-move progress, partial failure, operation exclusion | Current normal RTL plus model/controller tests prove running, ordered completion, partial failure and refusal while another operation runs | **PERMANENT** | `test/rtl/issue-92.test.tsx`; `src/os/file-manager/{move-operation,operation-state,operation-presentation}.test.ts` | None |
| #93 | `issue-93-browser-geometry-spec.md`; real image thumbnail frame containment and source aspect-ratio geometry | Current Bun/RTL tests only prove `contain`, eligibility, object-URL cleanup and fallback; no current packaged geometry spec measures rendered rectangles | **MISSING** | Current lower tests: `src/os/visual/{visual,visual.components}.test.*`, `src/os/file-manager/polish.test.tsx`; historical `test/e2e/plasmon-image-thumbnails-93.spec.ts` is absent from current r2 | Add the smallest packaged geometry regression described below |
| #94 | `.red/issue-94.red.md`; bounded video-thumbnail probe/lease lifecycle | The packet explicitly rejected a fake Bun/browser API; current r2 has no accepted bounded video-thumbnail seam or valid gate | **SUPERSEDED** | Historical packet disposition; current `VideoPlayer`/thumbnail architecture has no approved probe contract | Do not reopen until an approved production media probe/lease and fixtures exist |
| #95 | `test/e2e/plasmon-desktop-label-95.red.spec.ts`; selected long-label overlay geometry, hit testing, edge bounds and F2 separation | Current required golden path performs the same compact/expanded/edge/pointer-transparent label and bounded F2 checks | **PACKAGED** | `test/e2e/plasmon-golden-path.spec.ts`; `src/os/file-manager/desktop-label.test.tsx` | None |
| #108 | `issue-108-closure-audit.md`; Explorer Back/Forward/Up/history and visible adapter journey | Current navigation model tests plus required packaged golden path click real folder activation and Back/Forward controls | **PACKAGED** | `src/native-apps/explorer/navigation.test.ts`; `test/e2e/plasmon-golden-path.spec.ts` | None |
| #110 | `issue-110-packaged-persistence-contract.md`; installed Fs-backed hidden-file toggle across reopen/reload | Current preference/visibility tests prove Fs persistence and `includeHidden` delegation, but no current packaged test performs the visible toggle/reopen journey | **MISSING** | `src/os/file-manager/preferences.test.ts`; historical `test/e2e/plasmon-hidden-preference-110.spec.ts` is absent from current r2 | Add the smallest packaged persistence regression described below |
| #115 | `.red/issue-115.red.md`; shared command seam across real consumers | This was characterization/architecture readiness, not a valid executable RED: source-shape assertions were expressly rejected. Later FileManager command/adaptor decomposition made the proposed packet unnecessary | **SUPERSEDED** | `src/os/file-manager/use-file-manager-commands.ts`, `test/refactorGuards.test.ts`, current command outcome tests | Do not manufacture a structural test or reopen the satisfied decomposition |
| #169 | `.red/issue-169.red.test.ts`; malformed managed Start category is bounded and recoverable | Current normal production reconciliation test proves collision preservation, idempotence, recovery and identity metadata | **PERMANENT** | `src/os/shell/startMenuReconciliation169.test.ts` | None |
| #171 | `issue-171-installed-browser-spec.md`; bounded installed Element icon request budget | Current Bun coalescing test and required packaged asset/request test prove bounded, non-repeating package-local icon resolution | **PACKAGED** | `src/os/neutron/icon-concurrency.test.ts`; `test/e2e/plasmon-presentation-assets.spec.ts` | None |
| #172 | `issue-172.composed.red.test.ts`; Trash restore placement composition preserves free slots/incumbent identity | Exact composed packet is not present, but current desktop placement and filesystem Trash tests prove the same stronger NodeId/occupancy policy | **EQUIVALENT** | `src/os/desktop/{issue-192,layout}.test.ts`; `src/os/fs/desktopCore.test.ts`; `test/trashLifecycle.test.ts` | None |
| #173 | repaired compact/spatial List packet; multi-column rendering and ArrowRight geometry | Current spatial model tests and required packaged List spec prove rendered columns, spatial navigation and Details separation | **PACKAGED** | `src/os/file-manager/{spatial-navigation,view-strategy}.test.ts`; `test/e2e/plasmon-list-layout-173.spec.ts` | None |
| #174 | `.red/issue-174.red.test.ts`; one canonical `.sys` Search projection and canonical activation | Current Search projection, activation, classification and refactor tests prove de-duplication, identity and opening policy | **EQUIVALENT** | `src/os/shell/search-projection.test.ts`, `src/os/shell/activation.test.ts`, `test/resourceOpenCrossSurface.test.ts` | None |
| #175 | `test/e2e/plasmon-search-geometry-175.red.spec.ts`; stable Search panel/result geometry and overflow bounds | Current smoke still explicitly permits known Search right overflow, the dedicated historical spec is absent, and the implementation remains owned by unmerged PR #337 | **STILL RED** | `test/e2e/plasmon-refactor-smoke.spec.ts` allowance; open PR #337; no browser execution claimed in this audit | Product owner must finish #175/#337, then promote and unquarantine its exact geometry acceptance |
| #178 | authority/precedence/consumer maps and invalid cast-based RED | Current classifier and all consumer tests prove explicit MIME/type precedence, stable identity and shared consumers; the old invented API shape is not a contract | **EQUIVALENT** | `test/refactor/189/issue-189.test.ts`, `src/os/file-manager/file-manager.test.ts`, `src/os/shell/search-projection.test.ts` | None; do not restore the cast-based packet |
| #182 | `.red/issue-182.red.test.ts`; root/Favorites inventory excludes managed Downloads but preserves user tree | Current normal filesystem and Explorer Favorites tests cover fresh inventory, preservation, rename and default-favorite policy | **PERMANENT** | `src/os/fs/issue-182.test.ts`, `src/native-apps/explorer/favorites.test.ts` | None |
| #189 | `test/refactor/189/issue-189.test.ts`; shared classification/MIME authority | Current normal classifier and consumer tests are active and preserve explicit-over-derived semantics and identity | **PERMANENT** | `test/refactor/189/issue-189.test.ts` | None |
| #190 | shared presentation/asset identity packet; package-relative artwork and fallback | Current Visual tests plus required installed asset/request acceptance prove shared vocabulary and package-local bytes | **PACKAGED** | `src/os/visual/issue-190.test.ts`; `test/e2e/plasmon-presentation-assets.spec.ts` | None |
| #191 | `.red/issue-191.red.test.ts` and browser packet; NodeId FileEntry state plus bounded rename geometry | Current Bun/RTL characterization and required packaged geometry acceptance are both active | **PACKAGED** | `src/os/file-manager/issue-191.characterization.test.ts`; `test/rtl/issue-191.test.tsx`; `test/e2e/plasmon-file-entry-191.spec.ts` | None |
| #192 | `.red/issue-192.red.test.ts`; deterministic occupied-slot repair and invalid-coordinate normalization | Current normal Bun placement tests preserve incumbent identity, repair collisions and normalize workspace bounds; packaged adapter test also exists | **PERMANENT** | `src/os/desktop/issue-192.test.ts`, `src/os/desktop/layout.test.ts`; `test/e2e/plasmon-desktop-placement-192.spec.ts` | None |
| #193 | `issue-193-final-packet.md`; Search uses canonical filesystem/classification/open/presentation authorities | Current Search projection, surface-state, activation, RTL and packaged golden-path tests prove the semantic contract; geometry is separately #175 | **EQUIVALENT** | `src/os/shell/{search-projection,search-surface-state,activation}.test.ts`, `test/rtl/issue-217.test.tsx`, `test/e2e/plasmon-golden-path.spec.ts` | None for core; track #175 separately |
| #194 | `.red/issue-194` packet; focused filesystem-backed Start surface states and intent | Current Start controller/state tests, RTL adapter test and packaged Start/Search journey are active | **PERMANENT** | `src/os/shell/{start-menu-reconciliation-controller,start-surface-state}.test.ts`, `test/rtl/issue-194.test.tsx`, `test/e2e/plasmon-golden-path.spec.ts` | None |
| #195 | `.red/issue-195.red.test.ts`; refresh relevance and stable NodeId selection across FileManager decomposition | The adopted characterization is active, with render-state, command and adapter tests around it | **PERMANENT** | `src/os/file-manager/issue-195.characterization.test.ts`, `src/os/file-manager/render-state.test.ts`, `src/os/file-manager/file-manager.test.ts` | None |
| #196 | `issue-196-final-packet.md`; explicit Grid/List/Details strategies and shared selection | Current normal Bun/RTL strategy tests and required packaged List geometry test prove the same contract | **PERMANENT** | `src/os/file-manager/view-strategy.test.ts`, `test/rtl/issue-196.test.tsx`, `test/e2e/plasmon-list-layout-173.spec.ts` | None |
| #197 | `issue-197-luna-a-shell-input-packet.md`; Luna-A authority/dependency input to Luna-B Shell work | This was a cross-lane implementation handoff, not an executable Luna-A RED gate; current Shell tests belong to Luna-B and no duplicate gate is required | **SUPERSEDED** | Historical packet disposition; current `src/os/shell/*` tests and integrated ownership | No promotion work in Lane A |
| #201 | `issue-201-final-cleanup-contract.md`; migration-gated legacy cleanup/reachability | No executable RED was claimed; cleanup remains explicitly owned by active PR #339 and depends on other accepted migrations | **SUPERSEDED** | Historical dependency-gated packet; open PR #339 ownership check | Do not modify or duplicate #201 under this audit |

## Totals

- PERMANENT: **10**
- EQUIVALENT: **6**
- PACKAGED: **8**
- QUARANTINED: **2**
- MISSING: **2**
- STILL RED: **1**
- SUPERSEDED: **4**

A focused current-source Bun run of the deterministic subset passed **34 tests,
0 failures, 103 expectations**:

```text
bun test apps/plasmon/src/os/file-manager/operation-state.test.ts \
  apps/plasmon/src/os/file-manager/operation-presentation.test.ts \
  apps/plasmon/src/os/file-manager/issue-195.characterization.test.ts \
  apps/plasmon/src/os/file-manager/spatial-navigation.test.ts \
  apps/plasmon/src/os/file-manager/view-strategy.test.ts \
  apps/plasmon/src/os/desktop/issue-192.test.ts \
  apps/plasmon/src/os/desktop/layout.test.ts \
  apps/plasmon/src/os/fs/issue-182.test.ts \
  apps/plasmon/src/os/shell/start-surface-state.test.ts \
  apps/plasmon/src/os/shell/start-menu-reconciliation-controller.test.ts \
  apps/plasmon/src/os/visual/issue-190.test.ts
```

The current test-inventory verifier also passed:
`node test/ci/verify-plasmon-test-inventory.mjs` — fast 133, RTL 13, package 1,
browser 19, non-Plasmon browser 13, excluded RED 0. The broader detached
worktree Bun attempt was operationally blocked by missing `react`,
`@testing-library/react`, and `neutron-tools/app` dependencies; those errors
are not product RED evidence. No packaged browser session was started.

## PROMOTION GAPS

### #93 — image thumbnail geometry

1. **Exact original packet/test:** `apps/plasmon/test/tdd/.red/issue-93-browser-geometry-spec.md` and historical `test/e2e/plasmon-image-thumbnails-93.spec.ts`.
2. **Issue:** #93.
3. **Contract:** real packaged image fixtures preserve intrinsic aspect ratio inside the thumbnail frame; rendered geometry remains contained, failed images fall back, and selection remains usable.
4. **Truthful layer:** packaged browser.
5. **Smallest permanent test:** one installed Desktop/FileManager journey importing one portrait and one landscape SVG, measuring frame/image rectangles and intrinsic ratios, then asserting containment, fallback, and selection after load.
6. **Product defect?:** test-only promotion gap. Current lower-layer `contain`/cleanup behavior is already green; no product defect is asserted here.

### #110 — filesystem-backed hidden-file preference

1. **Exact original packet/test:** `apps/plasmon/test/tdd/.red/issue-110-packaged-persistence-contract.md` and historical `test/e2e/plasmon-hidden-preference-110.spec.ts`.
2. **Issue:** #110.
3. **Contract:** in the installed package, toggle Show Hidden Files through the real Explorer UI, observe a hidden resource appear/disappear without NodeId mutation, close/reopen Explorer, and reload the packaged app with preference reconstructed from FsService rather than browser-local storage.
4. **Truthful layer:** packaged browser.
5. **Smallest permanent test:** one packaged Explorer fixture with one hidden file; toggle on/off, record visibility/NodeId, reopen Explorer, reload iframe, and assert the same preference and identity.
6. **Product defect?:** test-only promotion gap. Headless preference and visibility semantics are current green; no product defect is asserted.

## PRODUCT GAPS

- **#175 — Search geometry remains unresolved in current r2.** The current smoke explicitly allows known right overflow and the implementation is still owned by unmerged PR #337. Do not modify that packet from Luna A. After integration, require the exact Search geometry gate and keep unrelated smoke coverage strict.

## QUARANTINED ACCEPTANCE

- **#66:** `test/e2e/plasmon-drag-preview-66.spec.ts` is present and semantically complete but filtered by `@r2-quarantine`; restoration Issue **#320** owns the final directory-drop stability repair.
- **#86:** `test/e2e/plasmon-diagnostic-selection-86.spec.ts` is present and semantically complete but filtered by `@r2-quarantine`; restoration Issue **#330** owns the setup stability repair.

No stale `.red` file, audit note, or unmerged implementation branch was counted
as current permanent protection. No active implementor branch was modified.
