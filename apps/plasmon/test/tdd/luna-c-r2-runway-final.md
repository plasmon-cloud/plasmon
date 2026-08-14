# Luna-C r2 runway final disposition

**Goal: LUNA-C R2 RUNWAY COMPLETE**

This is a planning terminal, not an implementation claim. It records the
current integrated r2 evidence and routes every Native Apps / Editors / Games /
Media / Runtime item to one terminal disposition. Browser/package evidence is
not promoted to implementation GREEN without the installed proof.

## Terminal dispositions

| Issue | terminal disposition | exact remaining work or reason |
|---|---|---|
| #48 | **FINAL IMPLEMENTOR PACKET READY** | EmulatorJS implementation/association path exists; remaining work is the installed legal-ROM browser startup, Worker/WASM/canvas lifecycle, teardown, and local-asset health proof. Do not extract a generic runtime until this evidence is recorded. |
| #58 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Standalone Review Atom MVP model and package semantics are integrated and covered. Any remaining installed/manual demo evidence belongs to Review/package acceptance, not a Luna-C implementation lane. |
| #64 | **BLOCKED — exact missing product/runtime dependency** | Shipped js-dos exposes no authorized save/export/import handle or explicit save boundary that can produce a stable NodeId-bound FsService artifact. This is a missing runtime/product seam, not a Testing harness gap. |
| #67 | **FINAL IMPLEMENTOR PACKET READY** | Reuse the existing packaged lane to observe real Monaco Worker construction, communication, errors, edit/save/reopen in Chromium and Firefox. A ready DOM/editor marker or HTTP 200 is insufficient. Depends on the accepted #89 route and #200 host. |
| #89 | **FINAL IMPLEMENTOR PACKET READY** | Move the worker package/adapter from the current top-level `monaco-workers` assumptions to the accepted `/System/Program Files/MonacoEditor` logical runtime/transport, preserve label routing, retire legacy consumers, then prove installed Worker startup. |
| #96 | **FINAL IMPLEMENTOR PACKET READY** | Replace six generated first-party HandlerDefinition/NativeAppDefinition data-URI identity references with packaged offline references; preserve IDs/associations and consume #190's shared Visual resolver. Package/offline proof remains. |
| #112 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Semantic chrome and ownership are characterized; no truthful structural RED exists without prescribing a wrapper, CSS, or pixels. App-specific chrome remains domain-owned. |
| #113 | **FINAL IMPLEMENTOR PACKET READY** | Implement accepted Text title/language/command/minimap parity while preserving document/session authority. The RTL route has an exact shared Testing dependency (`CSS.escape` in canonical Happy DOM); real Monaco interaction remains packaged-browser evidence. |
| #114 | **FINAL IMPLEMENTOR PACKET READY** | Implement Markdown title, deterministic formatter/error state, and discoverable command affordances; preserve modes/sanitized preview. Same exact RTL Testing dependency as #113; formatter/Monaco interaction is browser-bound. |
| #121 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Explicit legal js-dos fixture/package/open mechanics are integrated. Any current installed rerun is acceptance evidence, not a new runtime implementation. |
| #122 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Games reference UX audit and bounded parity packets are complete; no implementation is authorized from research alone. |
| #123 | **BLOCKED — exact missing product contract** | #189/#190 do not define game-artwork metadata field/provenance, source authority, package envelope, size policy, or stable identity rules. Do not invent a Games-only resolver or test fixture contract. |
| #124 | **BLOCKED — exact dependency not integrated** | Cannot attach a preview to a save until #64 defines the authoritative stable save artifact and explicit save boundary. Preview must remain non-authoritative and must not block save. |
| #170 | **DEFERRED — outside Luna-C r2 runway** | Review.neutron visual/demo polish is Review-owned; existing closure evidence is retained and no Plasmon runtime implementation belongs here. |
| #178 | **DEFERRED — outside Luna-C ownership** | Canonical MIME/language inference is Luna-A/filesystem-owned; #200 consumes the accepted classifier and must not fork its tables. |
| #179 | **FINAL IMPLEMENTOR PACKET READY** | Change default Text/Markdown autosave to explicit opt-in while preserving `DocumentSession`, conflict checks, dirty close, model identity, and settings authority. Deterministic RED already exists; Monaco browser execution is unnecessary for byte/dirty semantics. |
| #180 | **FINAL IMPLEMENTOR PACKET READY** | Photos helper behavior is deterministic; finish the installed denied-fullscreen workspace geometry/no-pageerror proof under unchanged sandbox/FeaturePolicy. No permission grant or fullscreen simulation is valid. |
| #200 | **FINAL IMPLEMENTOR PACKET READY** | Luna-A owns the shared Monaco browser-runtime host refactor. The final packet is `issue-200-monaco-host-final-packet.md`; #89 path and #67 browser health are prerequisites. |
| #202 | **BLOCKED — exact coordination dependency** | js-dos storage bootstrap still emits `StorageManager.estimate` and sandbox directory errors. Under current coordination policy no implementation owner is available; preserve the security boundary and #187 allowances. This is not a Testing gap and not permission to weaken the sandbox. |

## Explicit non-generic blocker distinctions

- **#64:** missing shipped runtime/product save seam.
- **#123:** missing accepted product metadata contract.
- **#124:** blocked by #64's not-yet-integrated save artifact/boundary.
- **#202:** blocked by current owner/coordination policy, with exact runtime
  errors retained; no sandbox relaxation.

The only genuine shared Testing dependency in this set is the #113/#114 RTL
attempt to mount the production Monaco path in canonical Happy DOM. Testing may
provide a non-engine chrome adapter or route those assertions to the packaged
browser; it must not mock Monaco or add a CSS polyfill and call that runtime
proof.

## #200 implementation runway and overlap map

### Authorities that must not move into the host

| authority | canonical files | #200 rule |
|---|---|---|
| document bytes, NodeId, stable read, dirty/save/conflict/autosave | `src/native-apps/text/document.ts`, `useDocumentSession.ts` | consume callbacks/state; never persist from Monaco lifecycle |
| close negotiation | `text/documentClose.ts`, `DocumentClosePrompt.tsx`, `useDocumentCloseProtection.ts` | preserve Process request/Save/Discard/Cancel fencing |
| Process/window lifecycle | `src/os/process/*`, `src/os/windowing/*` | no host-owned close or window authority |
| resource classification/language policy | `src/os/fs/resourcePolicy.ts` and `src/os/fs/index.ts` | consume #189/#178 output; no duplicate extension table |
| Program Files managed runtime identity | `src/os/fs/programFiles.ts` | consume #89's accepted route; no `.sys` or second filesystem authority |

### Likely #200 implementation files

| file | role | overlap/routing |
|---|---|---|
| `src/native-apps/text/MonacoEditorSurface.tsx` | shared browser host/lifecycle/readiness/model bridge | primary #200 seam; serialize host-interface changes |
| `src/native-apps/text/monacoEnvironment.ts` | one Worker bootstrap adapter | serialize with #89 path decision; no duplicate Markdown adapter |
| `src/native-apps/text/editorModel.ts` | deterministic model ownership/language adapter | safe Bun-first work; preserve distinct URI/exact disposal |
| `src/native-apps/text/TextEditor.tsx` | Text-owned title/status/commands and host consumer | overlaps #113 and #112 content chrome; wire only after host contract |
| `src/native-apps/markdown/MarkdownEditor.tsx` | Markdown modes/preview/formatter and host consumer | overlaps #114 and #112 content chrome; formatter remains Markdown-owned |
| `src/native-apps/text/editorChrome.ts` | current shared editor toolbar/status styling helpers | likely #112 overlap; freeze or explicitly coordinate before editing |
| `src/native-apps/text/monacoAdapter.test.ts`, `engineBadge.test.ts`, model tests | deterministic host policy | parallel-safe after contract; no DOM/Monaco simulation |
| `test/e2e/plasmon-monaco-packaged.spec.ts` and #67 health helpers | installed proof | serialize with #89 package URL and #187 allowance retirement |

### #112 and other refactor overlap

#112 is complete as an architecture disposition, but its likely touched
surfaces overlap #200 if a second Sol lane changes:

- `TextEditor.tsx` and `MarkdownEditor.tsx` toolbars/status/content roots;
- `text/editorChrome.ts` shared editor chrome tokens/helpers;
- any proposed shared visual primitive under `src/os/visual/primitives.tsx`
  or `presentation.ts`;
- app root/window content wrappers used by `NativeProcessHost.tsx`.

Coordinator should schedule #200 host extraction separately from a #112/native
chrome refactor. The host lane may own Monaco files and pure policy tests, but
must not silently redefine shared toolbar/status primitives. If both lanes must
edit `TextEditor.tsx`, `MarkdownEditor.tsx`, or `editorChrome.ts`, serialize
those edits or land a frozen host interface first.

Additional serialization fences:

1. **#89 before #200/#67:** `build.ts`, `src/native-apps/packaging.ts`,
   `packaging.test.ts`, `monacoEnvironment.ts`, and e2e worker URL assertions
   are a single path migration surface.
2. **#178/#189 before language changes:** `src/os/fs/resourcePolicy.ts` is the
   classification authority; #200 must not repair it locally.
3. **#113/#114 after host contract:** consumer UI can proceed in parallel only
   once host props/readiness/error/model ownership are frozen; their shared
   Text/Markdown files otherwise serialize with #200.
4. **#179 fence:** `document.ts`, close protection, and save callbacks are
   #179 authority. #200 must not modify them; if a wiring change is unavoidable,
   coordinate rather than co-editing.
5. **#96 independent:** `content-apps.ts` and `public/static/plasmon/icons/*`
   are not #200/#112 files and can run in parallel through #190's resolver.
6. **#180 independent:** Photos fullscreen/media files do not overlap #200 and
   are safe as a separate browser lane.

## Parallel-safe areas

- #96 identity metadata/assets through the existing #190 Visual seam.
- #179 deterministic `DocumentSession` autosave policy, provided #200 does not
  touch document authority files.
- #180 Photos fullscreen helper and installed geometry acceptance.
- #200 `editorModel.ts` worker-label/language pure tests before browser host
  wiring, provided #89's final path contract is recorded.
- #64/#123 contract discovery can proceed as owner handoffs, but no speculative
  product code or fake RED is authorized.

## Browser/package boundary inventory

The following require the installed Neutron package and are not proven by a DOM
node or Bun test: Monaco Worker construction/communication; Firefox opaque-origin
behavior; canonical Program Files worker transport; real Monaco readiness and
focus; Photos denied-fullscreen geometry; EmulatorJS/js-dos Worker/WASM/canvas;
media codec/frame extraction; and final offline package URL/HTTP behavior.

## Final routing

No production code is changed by this packet. Existing REDs, browser specs, and
owner fences remain intact. The implementation runway is complete when owners
consume the READY packets in dependency order; planning does not claim those
product Issues are already implemented.
