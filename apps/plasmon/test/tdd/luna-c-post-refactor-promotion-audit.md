# Luna-C post-refactor promotion audit — CURRENT r2

**Target:** `origin/release/0.1.0-r2`

**Integrated source inspected:** `c047aa7391046dc28efc4d187f8871bb0de4afd2`

**Audit context:** 2026-08-18T16:31:10Z. `git fetch origin --prune` was run
first. The current release was inspected with `git show`/`git grep`; this TDD
worktree was not used as product authority and no feature branch was merged.
`gh pr list --state open --search "#N"` returned `[]` for every Issue in this
artifact's table (active implementation ownership: none found). The worktree
had a pre-existing unrelated modification at
`packages/neutron-cli/src/index.ts`; it was not changed.

This audit counts only executable tests in CURRENT r2. TDD `.red` files,
matrices, ledgers, Issue prose, and historical CI are evidence of the old gate,
not current protection.

## Promotion matrix

| Issue | Original gate | Current protection | Classification | Evidence/path | Action |
|---|---|---|---|---|---|
| #48 | `issue-48-emulatorjs-closure-audit.md`; local EmulatorJS/second-runtime startup, asset locality, teardown | Required installed EmulatorJS loader, legal NES fixture, game-start, canvas, local requests, no errors, teardown | PACKAGED | `test/e2e/plasmon-emulatorjs-proof.spec.ts`; `apps/plasmon/src/native-apps/emulatorjs/emulatorjs.test.ts` | None |
| #58 | `issue-58-review-mvp-closure-audit.md`; typed Atom/revision/history/persistence/portability | Review engine, persistence, validation, Markdown, and independently packaged Review workflow tests | EQUIVALENT | `apps/review/test/{engine,persistence,validation,markdown}.test.ts`; `apps/review/e2e/review.spec.ts` | None |
| #64 | `issue-64-progress-persistence-packet.md`; NodeId-bound save identity, rename/copy, corruption and failed-save semantics | Stable progress store, fsChanges round-trip, corruption/incompatible-runtime rejection, and close-save model | EQUIVALENT | `apps/plasmon/src/native-apps/jsdos/{progress.test.ts,save-lifecycle.test.ts}` | None |
| #64 | Same packet; real js-dos save -> close -> reopen restoration | Required installed demo closes and reopens the same filesystem game and requires `data-jsdos-progress-restored="true"` | PACKAGED | `test/e2e/plasmon-demo-game.spec.ts` | None |
| #67 | `issue-67-browser-health-contract.md`; real Monaco/Worker startup, communication, edit/save/reopen | Required packaged Text/Markdown Monaco journey plus Worker construction/handshake and health assertions | PACKAGED | `test/e2e/plasmon-monaco-packaged.spec.ts`; `test/e2e/plasmon-monaco-workers-89.spec.ts` | None |
| #79 | `issue-79-83-reconciliation.md`; Process/Window/document close composition | Headless clean, cancel, discard, save-close lifecycle across Document, Process, Windowing | PERMANENT | `apps/plasmon/test/issue-79-native-document-close-lifecycle.test.ts`; `apps/plasmon/src/native-apps/text/documentClose.test.ts` | None |
| #83 | `issue-79-83-reconciliation.md`; `.jsdos` and `.nes` association/open selection | Runtime-specific association registries and production open composition retain distinct handlers | EQUIVALENT | `apps/plasmon/src/native-apps/{jsdos/jsdos.test.ts,emulatorjs/emulatorjs.test.ts}`; `apps/plasmon/test/associationOpenComposition.test.ts` | None |
| #89 | `test/tdd/.red/issue-89.red.test.ts`; canonical Program Files worker route and label mapping | Current environment, package guard, route/opaque transport tests, and required installed Worker probe | EQUIVALENT | `apps/plasmon/src/native-apps/text/monacoEnvironment.test.ts`; `apps/plasmon/src/native-apps/packaging.test.ts`; `test/e2e/plasmon-monaco-workers-89.spec.ts` | None |
| #96 | `test/tdd/.red/issue-96.red.test.ts`; six first-party identities must be offline packaged assets, not data URIs | All six metadata references and asset existence are tested; installed Start/icon requests are required | EQUIVALENT | `apps/plasmon/src/native-apps/issue-96.test.ts`; `test/e2e/plasmon-presentation-assets.spec.ts` | None |
| #107 | `issue-107-closure-audit.md`; integrated packaged native/runtime baseline and strict health | Required smoke and Specialist inventories exercise installed Plasmon, Review, editors, games, and browser health | PACKAGED | `test/e2e/plasmon-refactor-smoke.spec.ts`; `test/ci/plasmon-test-inventory.mjs` | None |
| #112 | `issue-112-semantic-chrome-contract.md`; shared semantic native-app content chrome without a generic wrapper | Representative real RTL composition checks shared surface/state/panel/status vocabulary | PERMANENT | `apps/plasmon/test/rtl/issue-112-native-app-chrome.test.tsx` | None |
| #113 | `issue-113-full-acceptance-matrix.md`; deterministic title/language/status/command policy | Title/language, engine state, language mapping, cursor/model policy, and command mapping have fast tests | EQUIVALENT | `apps/plasmon/src/native-apps/text/{editorPresentation.test.ts,engineBadge.test.ts}`; `apps/plasmon/src/native-apps/shared/monaco/{editorCommands.test.ts,editorHostPolicy.test.ts}` | None for deterministic contract |
| #113 | Same packet; rendered Text title/language/status/cursor, minimap and command interaction through real Monaco | Current packaged test proves readiness/edit/save/reopen but does not assert the new visible controls or command effects | MISSING | Partial `test/e2e/plasmon-monaco-packaged.spec.ts`; implementation in `apps/plasmon/src/native-apps/text/TextEditor.tsx` | Add the smallest packaged Text journey assertions; see **PROMOTION GAPS** |
| #114 | `issue-114-full-acceptance-matrix.md`; Markdown formatter/provider and discoverable editor commands | Sanitized parser and Edit/Split/Preview semantics are green, but formatter and command UI remain absent in CURRENT | STILL RED | `apps/plasmon/src/native-apps/markdown/markdown.test.ts`; current `MarkdownEditor.tsx` has no formatter/command controls | Product implementation is still required; see **PRODUCT GAPS** |
| #121 | `issue-121-permanent-acceptance-checklist.md`; explicit normal installed js-dos fixture path | Package contains the authored fixture and required demo journey reaches it through FileManager/association/open | PACKAGED | `apps/plasmon/src/games/demoFixture.test.ts`; `apps/plasmon/test/package.test.ts`; `test/e2e/plasmon-demo-game.spec.ts` | None |
| #122 | `issue-122-games-ux-audit.md`; daedalOS game UX parity research | Research matrix was not a normative executable contract; accepted r2 work split this into bounded #48/#64/#121/#123/#124 contracts | SUPERSEDED | `apps/plasmon/test/tdd/issue-122-games-ux-audit.md`; current bounded game tests | Do not promote the research matrix as a test |
| #123 | `issue-123-game-artwork-red-spec.md`; accepted artwork metadata, fallback, identity/copy and shared presentation | Metadata validation, fallback, package-local fixture reconciliation, rename/copy identity, and Desktop/Search consumers are tested | EQUIVALENT | `apps/plasmon/src/{games/artwork.test.ts,os/fs/issue-123.test.ts,os/visual/issue-123.test.ts,os/shell/issue-123.test.ts}` | None |
| #123 | Same packet; installed package artwork must resolve offline on the visible game resource | Required demo-game journey asserts package artwork URL and decoded image | PACKAGED | `test/e2e/plasmon-demo-game.spec.ts`; `test/e2e/plasmon-presentation-assets.spec.ts` | None |
| #124 | `issue-124-save-screenshot-red-spec.md`; preview is bounded/non-authoritative, stable save identity survives missing/oversized preview | Save/preview metadata, replacement, missing bytes, size bounds, and FileManager fallback are deterministic | EQUIVALENT | `apps/plasmon/src/native-apps/jsdos/{progress-preview.test.ts,preview.test.ts}`; `apps/plasmon/src/os/file-manager/issue-124-preview.test.ts` | None |
| #124 | Same packet; installed js-dos save publishes a real blob-backed preview | Permanent browser test exists but is excluded by the r2 quarantine filter | QUARANTINED | `test/e2e/plasmon-demo-game.spec.ts` tagged `@r2-quarantine @issue-124 @issue-304`; `test/ci/QUARANTINED_BROWSER_TESTS.md` | Restore through exact Issue **#304** procedure |
| #170 | `issue-170-review-polish-closure-audit.md`; readable, truthful Review first demo and persistence workflow | Standalone packaged Review first-run readability and full create/edit/history/export/import/reopen workflow | PACKAGED | `apps/review/e2e/review.spec.ts`; Plasmon installed sibling discovery is in `test/e2e/plasmon-review-demo.spec.ts` | None |
| #179 | `test/tdd/.red/issue-179.red.test.ts`; Text/Markdown default autosave OFF and opt-in preserves conflict/dirty semantics | Focused DocumentSession tests cover default OFF, opt-in persistence, and revision conflict | EQUIVALENT | `apps/plasmon/src/native-apps/text/documentAutosave.test.ts` | None |
| #180 | `issue-180-packaged-browser-spec.md`; denied fullscreen must visibly fall back to in-workspace expanded Photos view | Helper and Windowing transition tests exist, but no required installed Photos journey injects/observes denied fullscreen and geometry | MISSING | `apps/plasmon/src/native-apps/photos/{fullscreen.test.ts,workspaceExpand.test.ts}`; no current `test/e2e` #180 spec | Add one packaged Photos denial/expanded-view journey; see **PROMOTION GAPS** |
| #187 | `issue-187-closure-audit.md`; refactor smoke must retain strict browser-health boundary and only named allowances | Fast refactor guards plus required installed smoke retain explicit first-party request/page-error health checks and #202 diagnostics | PACKAGED | `apps/plasmon/test/refactorGuards.test.ts`; `test/e2e/plasmon-refactor-smoke.spec.ts`; `test/e2e/plasmon-browser-health.ts` | None |
| #200 | `issue-200-monaco-host-final-packet.md`; one shared Monaco host, isolated model ownership, no Fs/Process authority leak | Shared-host consumer/authority guards and deterministic model/language/worker policy tests | EQUIVALENT | `apps/plasmon/src/native-apps/shared/monaco/{hostContract.test.ts,editorHostPolicy.test.ts}` | None |
| #202 | `issue-202-storage-bootstrap-red-spec.md`; embedded js-dos storage compatibility without sandbox relaxation or unexplained errors | Headless compatibility restoration and required installed demo assertions for absent StorageManager/sandbox errors | PACKAGED | `apps/plasmon/src/native-apps/jsdos/jsdos.test.ts`; `test/e2e/plasmon-demo-game.spec.ts`; `test/e2e/plasmon-refactor-smoke.spec.ts` | None |

## Totals

- **PERMANENT:** 2
- **EQUIVALENT:** 10
- **PACKAGED:** 10
- **QUARANTINED:** 1
- **MISSING:** 2
- **STILL RED:** 1
- **SUPERSEDED:** 1

The browser rows are intentionally separate from their deterministic rows. A
passing helper or Bun test does not promote an installed/browser requirement;
conversely, a packaged proof does not replace the lower-level authority tests.

## MISSING gate detail

### #113 — packaged Text parity regression

1. **Original packet:** `apps/plasmon/test/tdd/issue-113-full-acceptance-matrix.md` and `issue-200-monaco-host-final-packet.md` (the old `.red` directory contains no truthful Monaco UI RED).
2. **Issue:** #113.
3. **Contract:** after real Monaco readiness, the Text surface visibly derives the document title and language, reports cursor/status state, exposes Minimap/Word wrap and Find/Replace/Go-to-line controls, and those controls reach the real editor.
4. **Truthful layer:** packaged browser.
5. **Smallest test:** extend `test/e2e/plasmon-monaco-packaged.spec.ts`'s existing Text fixture journey with accessible assertions for the title/language/status and Minimap state, then click one command and assert the corresponding Monaco DOM/action effect. Keep model/session semantics in existing Bun tests.
6. **Scope:** test-only promotion gap; the implementation is present. It does not currently expose a new Product defect.

### #180 — packaged Photos denied-fullscreen regression

1. **Original packet:** `apps/plasmon/test/tdd/issue-180-packaged-browser-spec.md`.
2. **Issue:** #180.
3. **Contract:** in the installed hosted frame, a denied/unavailable fullscreen request is caught, Photos remains usable, and the in-workspace expanded view has the expected containment/geometry without granting fullscreen permission.
4. **Truthful layer:** packaged browser.
5. **Smallest test:** add one Specialist spec using the existing installed image fixture and the production Photos path; force the browser's real fullscreen policy to reject, activate the Photos expand control, and assert `data-photos-display-mode="expanded"`, visible content, bounded geometry, and no page error. Do not simulate the browser API in RTL.
6. **Scope:** test-only promotion gap; current helper/workspace implementation exists. It does not currently expose a new Product defect.

## PROMOTION GAPS

- **#113 — MISSING:** add the smallest real-Monaco visible-control assertions described above to the existing required packaged editor journey.
- **#180 — MISSING:** add the installed denied-fullscreen/expanded-view Specialist assertion described above.

## PRODUCT GAPS

- **#114 — STILL RED:** CURRENT r2 still lacks the accepted Markdown formatter/provider behavior and discoverable formatter/editor command UI. After implementation, add deterministic formatter/error tests and packaged Edit/Split/Preview command coverage; do not mark this gate promoted from the existing sanitizer/mode tests.

## QUARANTINED ACCEPTANCE

- **#124 — QUARANTINED:** `test/e2e/plasmon-demo-game.spec.ts` saved-preview blob-readiness test is permanently present but excluded by `@r2-quarantine`. Restore only under **Issue #304**, retaining the `blob:` assertion and the required five clean first-attempt runs described in `test/ci/QUARANTINED_BROWSER_TESTS.md`. Static package artwork and the required broad #64/#123/#202 demo journey do not satisfy this acceptance.
