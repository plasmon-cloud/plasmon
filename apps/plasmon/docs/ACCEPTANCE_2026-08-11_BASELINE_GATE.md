# Integrated packaged acceptance gate — 2026-08-11 review baseline

**Canonical Issue:** #107  
**Historical gate date:** 2026-08-12  
**Current refresh date:** 2026-08-25  

## Current `release/0.1.0-r2` execution refresh

This section is the current #107 gate. The historical matrix below remains preserved as dated provenance for the 2026-08-12 `version-0.1.0-os` pass; it is not silently promoted into current-r2 acceptance.

**Product basis before this report-only branch:** `release/0.1.0-r2` at `71f84fd2ad9bf43a4bd37d29e2122e597925ce9d`.

The #107 branch changes only this acceptance report and its documentation-review acknowledgement. Therefore the exact-head package/browser jobs below exercise Product code equivalent to that r2 basis. Product defects remain owned by their canonical Issues rather than being repaired inside this report task.

### Exact-head gate execution

| Gate | Run | Result | Current claim |
| --- | --- | --- | --- |
| Plasmon Fast CI | `32805252007` | **PRODUCT TESTS PASS / report marker stale** | 676 executable tests passed. The sole failure was this `apps/plasmon/docs` boundary's expected stale review fingerprint after editing the report; the final marker is refreshed separately from the report content. |
| Plasmon Packaged Smoke CI | `32805252012` | **PASS** | Package/build plus the five required Smoke browser specs passed on the report head. |
| Plasmon Packaged Browser CI | `32805251999` | **PASS** | The required Specialist browser inventory passed on the report head and uploaded its Playwright report. |

The current required browser surface is the inventory in `test/ci/plasmon-test-inventory.mjs`: five Smoke specs plus the required Specialist set. `plasmon-golden-path.spec.ts`, `plasmon-monaco-packaged.spec.ts`, the full demo-game/emulator proofs, and other profile-specific files are optional rather than required current-r2 gates. A historical or optional spec is not promoted into current acceptance merely because it remains checked in.

### Current-r2 finding matrix

| Finding | Current result | Evidence layer | Current-r2 disposition |
| --- | --- | --- | --- |
| Filesystem identity, collision naming, rename/move/delete semantics | **PASS** | Fast/model/service | Current filesystem and FileManager tests pass, including stable identity and persistence/recomposition contracts. |
| Desktop rename editor geometry | **PASS** | required packaged Smoke | `plasmon-file-entry-191.spec.ts` proves the active rename editor stays inside the owning Desktop FileEntry/workspace in the installed package. This is a geometry claim, not a subjective typography/polish claim. |
| Start/Search filesystem and native-app opening | **PASS** | Fast + required packaged Smoke | Canonical Start/Search/open-dispatch tests pass; required Smoke uses installed Search to open native Settings through the real Process/Windowing path. |
| Runtime-only hosts excluded from normal Start inventory | **PASS** | Fast/model | `runtimeOnlyInventory.test.ts` proves runtime-only process hosts are not normal user-launchable Start applications while preserving upgrade/customization behavior. The old #88 FAIL below is historical only. |
| Neutron Search classification/de-duplication/presentation | **PASS** | Fast + required Specialist inventory | Current Search projection tests pass, and required Specialist includes current Neutron/search presentation browser gates. The old #90 FAIL below is historical only. |
| `.neutron` filesystem-projection activation through an installed Element | **NOT-YET-TESTABLE** | exact installed projection boundary | The current required gate does not establish that a canonical `/Apps/*.neutron` filesystem projection itself was activated end-to-end. Do not infer this from direct Search/Element presentation. |
| Create Shortcut discoverability, creation, collision naming, and activation (#44) | **PASS** | required Specialist browser | `plasmon-create-shortcut-44.spec.ts` exercises the real toolbar and item-context command, visible shortcut state/artwork, collision creation, and normal double-click activation in installed Explorer. |
| Taskbar state derivation and visible wording/accessibility (#72) | **PASS** | Fast + required Specialist browser | `plasmon-taskbar-presentation-72.spec.ts` proves pinned-only/running/active state, accessible wording, native lifecycle projection, installed Element `Running`, and absence of raw yes/no/unknown runtime tokens. |
| Taskbar cross-authority lifecycle (#81) | **PASS** | composed headless | `apps/plasmon/test/taskbarLifecycle.test.ts` proves canonical Process/Windowing/taskbar lifecycle and external Windowing teardown reconciliation. |
| Shared Start/taskbar pin affordance (#109) | **AUTOMATED PASS / MANUAL PENDING** | required Specialist browser + human/manual | `plasmon-pin-affordance-109.spec.ts` proves packaged shared pin artwork loads, accessible labels/state are present, pinned/unpinned states are structurally distinct, and both Start and taskbar context consume the canonical affordance. The bounded packaged/manual visual check required by #109 remains open; structural/browser evidence is not promoted to visual acceptance. |
| Folder-drop target semantics | **PASS** | Fast/model | Canonical drop-target/move semantics pass below the browser boundary. |
| Folder-drop installed pointer lifecycle | **NOT-YET-TESTABLE** | quarantined browser boundary | `plasmon-filemanager-directory-drop.spec.ts` is in the current quarantine inventory; the required gate does not promote it. |
| Drag feedback/placement contracts that remain in required Specialist | **PASS** | required Specialist browser | Current required Specialist execution includes the non-quarantined drag-feedback/placement browser contracts and passed them. |
| Delete -> Recycle Bin -> restore / permanent delete / empty | **NOT-YET-TESTABLE** | lower-layer PASS; required packaged lifecycle absent | `trashLifecycle.test.ts` and Recycle Bin model tests pass the canonical authority semantics. The **current required Smoke/Specialist inventories contain no Recycle Bin journey**. The old optional `plasmon-golden-path.spec.ts` still launches an empty Recycle Bin, but that optional source is not current required execution and never covered the full lifecycle. |
| FileManager Download | **NOT-YET-TESTABLE** | deterministic helper PASS; browser boundary absent | Current lower-layer byte/name/MIME/object-URL behavior is covered, but the required installed browser inventory does not establish the browser-owned download result. |
| Selected filename/inline rename browser geometry | **PASS** | required Smoke/Specialist browser | Required current browser coverage includes tile-bounded rename geometry and non-quarantined inline-rename presentation contracts. This does not manufacture a separate human aesthetic judgment. |
| Start surface current packaged contracts | **PASS** | required Specialist browser | The required Specialist inventory includes the current Start-surface browser gate and passed it. Broad subjective visual review is still distinct from those assertions. |
| Start/Search click-away as a broad manual interaction claim | **NOT-YET-TESTABLE** | manual/interaction | No broader human interaction claim is inferred beyond the exact required browser assertions. |
| Text/Markdown deterministic editor behavior | **PASS** | Fast + required Specialist slices | Current deterministic document/editor tests pass, and required Specialist includes non-optional Text/Markdown browser slices such as language/parity/command contracts. |
| Full optional-profile Text/Markdown Monaco open/edit/save/reopen | **NOT-YET-TESTABLE** | optional profile-specific browser gate | `plasmon-monaco-packaged.spec.ts` remains optional/profile-specific. Required Smoke proves the installed native Settings/Monaco-ready boundary, not the complete optional-profile editor workflow. |
| Photos fullscreen fallback and Video unsupported-codec presentation | **NOT-YET-TESTABLE** | deterministic PASS; required browser boundary absent | Focused models pass, but the optional/profile-specific browser sources are not promoted into this required current-r2 gate. |
| `/System/Program Files` structural/package boundary | **PASS** | Fast + package/build | Current filesystem/package guards pass and required Smoke successfully packages/boots the supported current profile. |
| Program Files subjective visible presentation | **NOT-YET-TESTABLE** | human/manual | Structural package evidence does not prove subjective Explorer/runtime presentation quality. |
| Old boot-time Doom seed expectation | **SUPERSEDED** | accepted product contract | #29 intentionally retired unconditional demo-game boot seeding; restoring it would regress the accepted architecture. |
| Explicit installed `.jsdos` / EmulatorJS full-profile acceptance | **NOT-YET-TESTABLE** | optional profile-specific browser gates | Demo-game/EmulatorJS proofs are optional current inventory and are not promoted into the required slim r2 gate. |
| Active-OS visual/layout smoke after launcher-era CSS removal (#28) | **NOT-YET-TESTABLE** | human/manual | Current #28 authority still requires the bounded visual verification; this report does not manufacture it from unrelated browser assertions. |

### Current blockers retained by the gate

The required current-r2 package/browser lanes are green, but #107 is **not equivalent to “every historical acceptance row is closed.”** The remaining evidence gaps are explicit:

1. the complete visible Trash lifecycle is absent from required current packaged coverage;
2. direct installed activation of a canonical `/Apps/*.neutron` filesystem projection is not established here;
3. browser-owned Download remains outside the required current browser inventory;
4. quarantined directory-drop browser acceptance remains quarantined rather than promoted;
5. full optional-profile Monaco and game/emulator workflows remain optional-profile evidence, not required slim-r2 acceptance;
6. bounded human-only visual judgments such as #28 and Program Files subjective presentation remain human evidence;
7. #109's shared Start/taskbar pin affordance still needs its bounded packaged/manual visual review despite the automated Specialist assertions passing.

No new Product implementation defect was established by the required current-r2 Fast/Smoke/Specialist execution. The report therefore records the unresolved acceptance layer rather than creating duplicate Product work.

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
