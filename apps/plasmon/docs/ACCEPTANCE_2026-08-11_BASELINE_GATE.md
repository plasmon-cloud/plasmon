# Integrated packaged acceptance gate — 2026-08-11 review baseline

**Canonical Issue:** #107  
**Historical gate date:** 2026-08-12  
**Current refresh date:** 2026-08-25  

## Current `release/0.1.0-r2` execution refresh

This section is the current #107 gate. The historical matrix below remains preserved as dated provenance for the 2026-08-12 `version-0.1.0-os` pass; it is not silently promoted into current-r2 acceptance.

**Product basis before this report-only branch:** `release/0.1.0-r2` at `71f84fd2ad9bf43a4bd37d29e2122e597925ce9d`.

The #107 branch intentionally starts with documentation-only gate changes. Therefore its exact-head package/browser jobs exercise product code equivalent to that r2 basis unless this report identifies a separate product defect, in which case the defect remains owned by its canonical Issue rather than being repaired here.

### Current-r2 evidence already established before this gate run

Current repository tests materially change several old 2026-08-12 dispositions and must be treated as current evidence at their actual layer:

- **Runtime-only Start inventory: deterministic PASS.** `src/os/shell/runtimeOnlyInventory.test.ts` proves runtime-only process hosts are not user-launchable Shell applications and preserves upgrade/user-customization semantics. The old #88 FAIL is historical, not a current-r2 FAIL claim.
- **Neutron Search presentation: deterministic PASS.** `src/os/shell/search-projection.test.ts` proves canonical Neutron projection metadata is presented as an application, de-duplicates against direct Element discovery, preserves canonical opening identity, and omits runtime-state text. The old #90 FAIL is historical at this gate basis.
- **Taskbar cross-authority lifecycle: headless PASS.** `apps/plasmon/test/taskbarLifecycle.test.ts` is now integrated and proves canonical Process/Windowing/taskbar lifecycle plus external Windowing teardown reconciliation. This advances only the composed headless layer; visible wording/accessibility remains a separate acceptance claim.
- **Trash lower-layer authority remains PASS.** `apps/plasmon/test/trashLifecycle.test.ts` and Recycle Bin model tests prove canonical Delete/Trash/restore/permanent-delete/empty semantics. This still does not prove the complete installed visible lifecycle.

### Current-r2 packaged gap that this gate must not hide

The current required packaged inventory launches and renders Recycle Bin, but on the r2 basis above it does **not** execute the complete visible `Delete -> Recycle Bin -> restore/empty` journey. That is a current #107 packaged-acceptance gap, not evidence that the underlying #45 Trash authority is broken.

A separate ready Product PR may add stronger evidence for its own Issue, but unmerged branch evidence is not promoted into this current-r2 gate. This report records only evidence present on, or executed against, the gate basis.

### Exact-head gate execution

This report PR must record the exact-head outcomes of:

- Plasmon Fast CI / deterministic inventory;
- package/build validation;
- installed packaged browser golden path in the supported Neutron/PocketIC environment.

The workflow run IDs and conclusions are filled in after those exact-head jobs execute. A green narrow golden path proves only the behaviors it actually exercises.

### Manual-only acceptance remains manual

This implementation agent does not manufacture human visual evidence. The following still require bounded packaged/manual review unless current canonical Issue evidence has explicitly replaced that requirement:

- #28 active-OS visual/layout smoke after launcher-era CSS removal;
- #44 shortcut discoverability;
- #72 taskbar visible wording/accessibility;
- #109 shared pin-control visual acceptance;
- Download browser behavior;
- folder-drop visible feedback;
- selected filename/rename presentation;
- Start/Search click-away and visible Start inventory/layout;
- Text/Markdown Monaco user-visible edit/save/reopen behavior where not already proven by a current packaged gate;
- Photos fallback and Video unsupported-codec presentation;
- Program Files visible presentation;
- explicit installed js-dos fixture/game acceptance.

Any row not exercised at its required layer remains unaccepted with its current blocker stated; lower-layer tests are not promoted.

---

## Historical 2026-08-12 gate (provenance)

**Gate date:** 2026-08-12  
**Integration basis:** current `version-0.1.0-os`; the Issue branch is reconciled with integration changes that materially affect this baseline before handoff.

This historical report re-checked the still-relevant findings from the 2026-08-11 packaged/manual Plasmon review. It is acceptance evidence, not a feature implementation plan.

## Evidence rules

The project testing order is:

```text
pure/model/service
  -> headless cross-subsystem production composition
  -> small packaged/browser journeys
  -> human/manual acceptance
```

A lower layer is never promoted into a stronger claim. A deterministic Bun/headless PASS does not prove browser download behavior, Monaco readiness, fullscreen/media behavior, or visual presentation. A package that boots does not close unrelated product Issues.

Result meanings:

- **PASS** — evidence exists at the layer required for the stated finding.
- **FAIL** — a still-current canonical user-visible defect remains.
- **SUPERSEDED** — the old expectation is intentionally no longer the product contract.
- **NOT-YET-TESTABLE** — the required acceptance layer or accepted fixture/path is not available in the current integrated gate; the blocker is named.

## Required gate execution

Before this historical report was handed to review, the #107 PR was required to pass:

- `npm --workspace neutron-plasmon test`
- `npm --workspace neutron-plasmon run test:package`
- the existing installed-package Playwright golden path in the supported Neutron/PocketIC browser environment

The browser lane remains intentionally small. This Issue does not create broad UI scripting merely to replace human acceptance.

## Finding matrix

| Finding | Result | Evidence layer | Evidence / disposition | Canonical Issue(s) |
| --- | --- | --- | --- | --- |
| Desktop/FileManager shortcut activation | **PASS** | headless + packaged/browser | FileManager delegates activation to the canonical filesystem opener, including shortcut dereference. The packaged golden path double-clicks the durable NodeId-backed Desktop `Root` shortcut and reaches the native window path. | #31, #107 |
| `.sys` activation | **PASS** | packaged/browser | The installed golden path finds and opens Recycle Bin through real Shell/process/window behavior. Recycle Bin is the real `/System/RecycleBin.sys` native system application. | #32, #45, #107 |
| Neutron projection classification/de-duplication in Search | **PASS** | deterministic model | #49 is integrated: canonical `.neutron` projections classify as Apps and de-duplicate against direct Element discovery without becoming installation authority. | #49, #107 |
| Neutron projection Search presentation | **FAIL** | current canonical presentation defect | #90 remained open in this historical pass: Search still needed application-grade projection naming/icon/state rather than raw `.neutron`/runtime presentation. | #90, #107 |
| `.neutron` filesystem-projection activation | **NOT-YET-TESTABLE** | real installed Neutron boundary missing | Deterministic opening reached `NeutronBridge`, but the packaged journey launched Plasmon from the Kernel tile rather than activating an `/Apps/*.neutron` projection inside Plasmon. #120 explicitly left the real installed Element launch proof to packaged acceptance. | #31, #32, #120, #107 |
| Delete -> Recycle Bin -> restore / permanent delete / empty | **NOT-YET-TESTABLE** | composed headless PASS; visible packaged lifecycle outstanding | The integrated headless Trash regression composed FileManager, `TrashService`, and Recycle Bin and proved identity/metadata, restore, and permanent-delete/empty semantics. The packaged golden path proved Recycle Bin launched and rendered empty state, but did not execute the full visible lifecycle. | #40, #45, #77, #107 |
| FileManager Download | **NOT-YET-TESTABLE** | deterministic helper PASS; browser boundary outstanding | Focused tests proved FsService bytes, MIME/name preservation, anchor setup, and object-URL cleanup. Actual installed-browser download remained a browser-owned acceptance item. | #107 |
| FileManager collision naming | **PASS** | deterministic fast/headless | Tests covered generated-name collisions, copy suffix progression, extensions, directories, dotfiles, no-extension files, and case folding. | #107 |
| FileManager rename selection semantics | **PASS** | deterministic model/component | Tests covered basename-only file selection, full-name directory selection, selection stability, extension changes, and Enter/Escape commit/cancel. | #107 |
| Selected filename/rename label presentation | **NOT-YET-TESTABLE** | human/visual | CSS/component state was covered, but visible readability/overflow was not. #95 remained the canonical selected-label presentation defect. | #95, #107 |
| Folder-drop target semantics | **PASS** | deterministic model/component | Tests proved only a valid non-source directory became the drop target and received drop-target state. | #107 |
| Folder-drop visible feedback | **NOT-YET-TESTABLE** | human/visual | A deterministic drop-target class was not proof that the feedback was visually clear in the packaged desktop. | #107 |
| Start/Search filesystem result semantics | **PASS** | deterministic fast/headless | Search covered matching folders/file categories; #32 routed filesystem-backed Start/Search activation through the canonical opener; #49 added canonical Neutron-projection app classification/de-duplication. | #32, #49, #107 |
| Packaged Search -> native application launch | **PASS** | packaged/browser | The installed golden path searched for Recycle Bin, launched it, and observed the real native Recycle Bin window. | #32, #45, #107 |
| Start/Search click-away interaction | **NOT-YET-TESTABLE** | packaged/manual interaction | Production had click-away handling, but this historical gate did not broaden the golden path into generic overlay scripting. Human/manual packaged acceptance remained required. | #107 |
| Managed default `System` Start category retirement | **PASS** | deterministic filesystem/Start reconciliation | #87 was integrated: fresh reconciliation no longer created the managed default `System` category for Settings/Explorer/Properties, and focused migration tests preserved user moves/renames/deletions/custom folders while remaining idempotent. | #87, #107 |
| Visible packaged Start layout after `System` retirement | **NOT-YET-TESTABLE** | packaged/manual visual | #87 explicitly permitted packaged/manual confirmation of the resulting visible Start layout. This gate did not promote deterministic reconciliation tests into human visual acceptance. | #87, #107 |
| Runtime-only hosts in normal Start inventory | **FAIL** | current canonical inventory defect | #88 remained open in this historical pass: runtime-only hosts such as js-dos still needed to be excluded from normal user-launchable Start inventory without breaking direct association/runtime launch. | #88, #107 |
| Start pinning semantics | **PASS** | deterministic model/service | Pin state remained filesystem-backed and semantic pin/unpin behavior was covered below React. | #107 |
| Shared Start/Shell pin-control implementation | **PASS** | component/presentation | #109 was integrated: literal platform emoji pin controls were replaced by shared Plasmon pin iconography while preserving accessible labels and FsService-backed pin semantics. | #109, #107 |
| Shared Start/Shell pin-control visual acceptance | **NOT-YET-TESTABLE** | packaged/manual visual | #109 remained open with `needs-verification` for its bounded packaged/manual visual check. Component evidence was not promoted into human visual acceptance. | #109, #107 |
| Taskbar state derivation | **PASS** | deterministic model | #72's merged implementation derived pinned-only, launching, running, active, and uncertain states from canonical Process/Windowing/Neutron/Shell observations. Focused tests preserved genuine `unknown` uncertainty without raw runtime tokens in accessibility labels. | #72, #107 |
| Taskbar cross-authority lifecycle | **NOT-YET-TESTABLE** | composed headless regression not integrated | #81 still owned the shared-headless Process/Windowing/Shell lifecycle regression in this historical pass. | #81, #107 |
| Taskbar visible wording/accessibility | **NOT-YET-TESTABLE** | packaged/manual | #72 remained open with `needs-verification` specifically for the visible packaged/manual wording/accessibility check after its implementation merged. | #72, #107 |
| Text Monaco open/edit/save/reopen | **NOT-YET-TESTABLE** | packaged Monaco boundary blocked | Worker HTTP serving was not a usable-editor proof. #67 remained open and owned the compact installed-package Text journey. | #67, #107 |
| Markdown Monaco open/edit/save/reopen | **NOT-YET-TESTABLE** | packaged Monaco boundary blocked | Same boundary as Text; #67 owned real Monaco readiness/edit/save/reopen acceptance. | #67, #107 |
| Photos fullscreen rejection/fallback | **NOT-YET-TESTABLE** | deterministic PASS; browser boundary outstanding | Focused tests proved disabled/rejected fullscreen fell back cleanly to expanded view. Actual hosted-browser fallback remained browser/manual acceptance. | #107 |
| Video unsupported-codec behavior | **NOT-YET-TESTABLE** | deterministic PASS; browser media boundary outstanding | Focused tests proved MIME/support classification and actionable unsupported/load/decode messages. Actual installed-browser unsupported-codec presentation was not exercised by the current golden path. | #107 |
| `/System/Program Files` managed root + packaged js-dos assets | **PASS** | filesystem/headless + build/package structural | #57 established the managed root. The build installed pinned js-dos under `System/Program Files/js-dos`, verified required JS/WASM assets, and wrote runtime metadata before packaging. | #57, #107 |
| Program Files visible Explorer/runtime presentation | **NOT-YET-TESTABLE** | human/manual | Structural/filesystem evidence did not prove the visible Explorer presentation was understandable or polished. | #57, #107 |
| Old boot-time Doom seed expectation | **SUPERSEDED** | accepted product contract | #29 intentionally retired unconditional demo-game boot seeding. Restoring it would regress the accepted architecture. | #29, #121, #107 |
| Explicit installed-package `.jsdos` fixture -> playable js-dos | **NOT-YET-TESTABLE** | accepted packaged fixture path missing | The build contained pinned runtime/proof assets and the standalone games proof could exercise a dist fixture, but #121 remained open to establish the reusable explicit fixture path through the final installed package. #48/EmulatorJS was a separate second-runtime Issue and did not block this js-dos proof. | #121, #107 |
| EmulatorJS second-runtime acceptance | **NOT-YET-TESTABLE** | implementation absent | #48 remained open. This did not block current js-dos acceptance, but no EmulatorJS package/runtime claim was made by this gate. | #48, #107 |

## What the historical installed-package lane proved

On a green historical #107 head, the packaged lane proved that Plasmon could be built, packaged, installed in the supported Neutron/PocketIC environment, served through `/app/plasmon/`, launched from the Kernel tile, and complete the narrow golden path without page errors. Within that journey it also proved Monaco worker HTTP serving, Search-driven Recycle Bin launch, the empty Recycle Bin surface, the durable Desktop `Root` shortcut, and native edge snapping.

It did **not** imply that every Start item, taskbar state, media app, editor, download path, Neutron projection, or game runtime had passed acceptance.

## Historical remaining blockers recorded in 2026-08-12

The historical integrated desktop was not described as clearing the 2026-08-11 baseline while these directly relevant blockers remained:

1. **Start inventory was not fully accepted** — #87's managed `System` category retirement was implemented but still lacked visible packaged/manual confirmation; #88 remained the runtime-only inventory FAIL at that time.
2. **Neutron application Search presentation was incomplete** — #90; real installed projection activation also lacked package proof under #120.
3. **Shared pin controls still required independent visual acceptance** — #109 was implemented but remained `needs-verification` for the bounded packaged/manual check.
4. **Taskbar still needed composed lifecycle and visible acceptance** — #81 plus #72's remaining `needs-verification` packaged/manual check.
5. **Text/Markdown real Monaco workflows lacked integrated packaged proof** — #67.
6. **The explicit installed-package js-dos fixture/game path was not accepted** — #121; the old boot-time Doom seed remained intentionally retired.
7. **Human/browser acceptance remained** for Download, folder-drop feedback, selected filename/rename presentation, Photos fullscreen fallback, Video unsupported-codec presentation, and visible Program Files presentation.

No independently distinct new product failure was established by that evidence pass, so no duplicate Issue was created.

## Closure rule

#107 remains open until its remaining packaged/manual evidence is recorded. Merging a durable report, or obtaining a green package boot, does not by itself accept unresolved rows or close their canonical Issues.
