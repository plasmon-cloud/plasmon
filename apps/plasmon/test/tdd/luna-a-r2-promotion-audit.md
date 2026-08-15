# Luna-A r2 final promotion audit

Audit source: `origin/release/0.1.0-r2` at
`8cfb4d68414b271303bd0afefdcac9dc8449c315`.

Refresh performed before this audit with `git fetch origin --prune`. Production
source and tests were inspected in detached worktree
`/tmp/plasmon-r2-final-audit` at that exact SHA; the stale primary checkout was
not used as production authority. Root/applicable Plasmon instructions and
`apps/plasmon/TESTING.md` were read. No production source, CI policy, or active
implementation branch was modified.

## Lane-A final dispositions

| Issue | Final TDD disposition | Intentional RED? | RED path | Product owner | Promotion state |
|---|---|---|---|---|---|
| #44 | ALREADY GREEN | No | None; `.red/issue-44.red.md` is audit-only | SOL 1 | GREEN IN CURRENT R2; PR #149 `aaeb6b7` integrated |
| #51 | GREEN IN CURRENT R2 | Historical RTL RED | `.red/issue-51.red.ui.test.tsx`; `.red/issue-51.red.test.ts` | SOL 1 | GREEN IN CURRENT R2; PR #210 `f3459881` integrated; `test/rtl/issue-51-send-to-desktop.test.tsx` permanent regression |
| #65 | GREEN IN CURRENT R2 | Historical RTL RED | `.red/issue-65.red.ui.test.tsx` | SOL 1 | GREEN IN CURRENT R2; PR #208 plus recovery PR #232 integrated; `test/rtl/issue-65-operation-progress.test.tsx` permanent regression |
| #66 | BROWSER BOUNDARY | Yes — browser RED/spec gate | `test/e2e/plasmon-drag-preview-66.red.spec.ts`; packet `.red/issue-66.red.md` | SOL 1 | RED NOT YET CONSUMED; no implementation PR integrated |
| #86 | BROWSER BOUNDARY | Yes — browser RED/spec gate | `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts`; packet `.red/issue-86.red.md` | SOL 1 | RED NOT YET CONSUMED; no implementation PR integrated |
| #92 | GREEN IN CURRENT R2 | Yes — historical RTL RED | `.red/issue-92.red.ui.test.tsx`; promoted `test/rtl/issue-92.test.tsx` | SOL 1 | GREEN IN CURRENT R2; PR #223 `34e5daea` integrated; 3 promoted RTL tests pass |
| #93 | CHARACTERIZATION ONLY | No current deterministic RED | `.red/issue-93.red.md`; browser acceptance `test/e2e/plasmon-image-thumbnails-93.spec.ts` | SOL 1 | Deterministic GREEN IN CURRENT R2; browser boundary not executed |
| #94 | DEFERRED | No — fake Bun RED explicitly rejected | `.red/issue-94.red.md` policy/eligibility contract; no executable RED | SOL 1 + Coordinator dependency | DEFERRED; no promotion claim |
| #110 | GREEN IN CURRENT R2 | No current deterministic RED | `.red/issue-110.red.md`; browser acceptance `test/e2e/plasmon-hidden-preference-110.spec.ts` | SOL 1 | Headless GREEN IN CURRENT R2; packaged browser boundary pending |
| #115 | NO VALID CORRECTIVE RED | No | `.red/issue-115.red.md` is characterization/specification only | SOL 1 | No valid promotion claim; existing lower-layer guards remain green |
| #192 | GREEN IN CURRENT R2 | Historical Bun RED | `.red/issue-192.red.test.ts` | SOL 1 | GREEN IN CURRENT R2; PR #205 `51cd761c` integrated; placement tests pass |
| #195 | GREEN IN CURRENT R2 | No valid structural RED; characterization only | `.red/issue-195.red.test.ts`; permanent characterization `issue-195.characterization.test.ts` | SOL 1 | GREEN IN CURRENT R2; PR #213 `3d7042b` integrated and #196 consumed |

All 12 Lane-A queue entries are terminal `[x]` dispositions. No Lane-A entry
is `[~]`.

## #66 final browser boundary record

- **Current release reproduction:** source inspection at exact
  `8cfb4d68414b271303bd0afefdcac9dc8449c315` confirms the current FileManager
  drag path only marks the dragged entry (`.is-dragging`) and sets its pointer
  events transparent; no claimed above-window multi-selection preview/drop
  acceptance is integrated. The real Playwright gate was **not executed**:
  packaged session/browser runtime was unavailable. This is an operational block,
  not a fabricated product failure.
- **PRESERVE:** real multi-selection, stable NodeId drag/drop ownership,
  FileManager/drop-target/FsService final outcome, native Windowing z-order,
  pointer transparency after observation, Escape/cancel cleanup, and ordinary
  entry drag behavior.
- **CHANGE:** provide a real browser-observable count-two drag preview above a
  native Explorer window, preserve underlying hit testing, and clean up on
  Escape and successful drop.
- **UNSPECIFIED:** preview DOM/visual implementation, exact stacking mechanism,
  animation/placement, and CSS/z-index values. Do not assert source shape or a
  numeric z-index.
- **Real-browser requirement:** geometry, overlap, `elementFromPoint`, pointer
  transparency, pointer capture/drag movement, and actual Explorer drop require
  Playwright against the installed package.
- **Permanent regression expectation:** retain
  `test/e2e/plasmon-drag-preview-66.red.spec.ts` as the promotion regression;
  it must prove count-two preview, overlap, stack probe, restored pointer
  transparency, Escape/drop cleanup, and FileManager-owned drop outcome.
- **Product owner:** SOL 1.
- **Promotion:** **RED NOT YET CONSUMED**.

## #86 final browser boundary record

- **Current release reproduction:** source inspection at exact
  `8cfb4d68414b271303bd0afefdcac9dc8449c315` confirms `.fm-root` applies
  `user-select: none`, while `.fm-error-banner`/`.fm-error` have no bounded
  selectable-text override. The real Playwright gate was **not executed**:
  packaged session/browser runtime was unavailable. No browser failure is
  claimed from this operational block.
- **PRESERVE:** FileEntry selection, marquee, drag, rename controls, button
  interactivity, error semantics, and dismissal/retry behavior.
- **CHANGE:** allow selection of clearly copy-worthy diagnostic/error text only,
  without globally enabling selection for draggable resources.
- **UNSPECIFIED:** exact selector/utility class, whether all path/hash fields are
  selectable, and the packaged invalid-address fixture details.
- **Real-browser requirement:** inherited CSS, real mouse selection ranges,
  `window.getSelection()`, and distinction from FileEntry drag require
  Playwright.
- **Permanent regression expectation:** retain
  `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts`; it must select the
  diagnostic text, prove no FileEntry enters drag state, then prove ordinary
  FileEntry drag still works.
- **Product owner:** SOL 1.
- **Promotion:** **RED NOT YET CONSUMED**.

## #94 deferred record

- **Exact reason:** no production bounded video frame-probe/frame-lease seam or
  redistribution-safe deterministic media fixtures currently exists. Decode,
  seek timing, codec support, object URL lifetime, cancellation, and frame
  availability are genuine browser/media contracts.
- **Missing authority:** a bounded Visual/media probe policy owned below the
  React FileManager adapter, while filesystem classification/resource identity
  and VideoPlayer playback remain separate authorities.
- **Owner:** SOL 1, with Coordinator dependency review for the accepted media
  seam and fixture policy.
- **Reopen event:** reopen TDD when the production bounded probe/lease contract
  and approved same-origin fixtures are integrated and available for a truthful
  browser gate (supported, malformed, aspect-ratio, cancellation/unmount cases).
- **Why no RED now:** a Bun test would fake codec/decode/seek/browser cleanup;
  a source-shape assertion would not prove the acceptance behavior. No truthful
  additional RED is warranted.

## Promotion audit details

| Issue | Exact RED base/evidence | Implementation PR/commit | Permanent regression | Current result | Integrated into current r2? |
|---|---|---|---|---|---|
| #44 | N/A; no valid corrective RED | PR #149 / `aaeb6b738ed3f7e5da6d4e987138c6f2e76f18d8` | Create Shortcut, Desktop/open/refactor guards | Green | Yes |
| #51 | Historical packet execution SHA was not retained; staging ancestry recorded as `3467309d2199beff40ba60dc8e5bf7ebe2164b26` | PR #210 / `f3459881bbb1fb151ea71b17d7c0f8bb83f8a9c7` | Send-to-Desktop RTL/headless tests | Green | Yes |
| #65 | Historical packet execution SHA was not retained; staging ancestry recorded as `3467309d2199beff40ba60dc8e5bf7ebe2164b26` | PR #208 / `2b6984e9`; recovery PR #232 / `aebb255b` | Operation-progress RTL/operation-state tests | Green | Yes |
| #66 | Exact current source base audited: `8cfb4d68414b271303bd0afefdcac9dc8449c315`; browser not executed | None | Playwright gate retained | Not executed; RED unconsumed | No |
| #86 | Exact current source base audited: `8cfb4d68414b271303bd0afefdcac9dc8449c315`; browser not executed | None | Playwright gate retained | Not executed; RED unconsumed | No |
| #92 | `5a6c9bb3d46d536c60a41382d5e3754539753dcd` delayed-real-move RED | PR #223 / `34e5daea6b59e66a7980a892df90a61729ffd7c5` | `test/rtl/issue-92.test.tsx`, move/operation tests | Green; 3 focused RTL tests pass | Yes |
| #93 | N/A; deterministic containment already green | None | Visual tests plus packaged thumbnail gate | Deterministic green; browser pending | N/A |
| #94 | N/A; no truthful executable RED | None | Future bounded media browser gate | Deferred | N/A |
| #110 | N/A; headless behavior already green | PR #151 / `ae3e290200b80cab877ab0d35a6fe24c3fce07d7` | Preference/visibility tests and packaged gate | Headless green; browser pending | Yes |
| #115 | N/A; source-shape/shared-seam RED invalid | None | Existing authority/refactor guards | No valid corrective RED | N/A |
| #192 | Historical gate staged from `3467309d2199beff40ba60dc8e5bf7ebe2164b26`; current release focused tests pass | PR #205 / `51cd761c207573a59197d53c9e2884335f2e7cc7` | `src/os/desktop/issue-192.test.ts`, layout/composed guards | Green | Yes |
| #195 | Characterization only; no corrective RED claimed | PR #213 / `3d7042b2102a5df51145a1965cf347430fde91b1` | `issue-195.characterization.test.ts`, adapter/strategy guards | Green | Yes |

## Current-release verification

Executed in detached current-release worktree:

```text
bun test ./apps/plasmon/src/os/desktop/issue-192.test.ts \
  ./apps/plasmon/src/os/file-manager/issue-195.characterization.test.ts \
  ./apps/plasmon/src/os/file-manager/move-operation.test.ts \
  ./apps/plasmon/src/os/file-manager/operation-presentation.test.ts \
  ./apps/plasmon/src/os/file-manager/operation-state.test.ts

11 passed, 1 dependency error; 29 expects.
```

The dependency error was `Cannot find module 'neutron-tools/app'` while loading
`move-operation.test.ts` in the detached worktree. The other 11 tests passed.
A Happy DOM variant was separately blocked by missing detached-worktree
`happy-dom` dependency. These are operational dependency blocks, not product
REDs. Existing prior focused evidence remains recorded in the individual
promotion packets.

The packaged browser environment was not executed. Missing packaged session or
browser runtime is an operational block, not a product RED or HARNESS GAP.

## FINAL STATUS

- Lane-A queue entries: **12**
- Finalized: **12/12 (100%)**
- Claimed: **0**
- Open: **0**
- RED NOT YET CONSUMED: **#66, #86**
- GREEN IN OPEN PR: **none in Lane A**; #176 is outside the queue and remains
  open PR #235
- GREEN IN CURRENT R2: **#51, #65, #92, #110 deterministic, #192, #195**
- Characterization/already-green: **#44, #93, #115**
- Browser boundary: **#66, #86, #93, #110 packaged portions**
- Deferred: **#94**
- Exact release SHA audited: **`8cfb4d68414b271303bd0afefdcac9dc8449c315`**
