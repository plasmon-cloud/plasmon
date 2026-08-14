# Luna-C current r2 re-audit: #64 / #113 / #114 / #123 / #124

**Audit timestamp:** 2026-08-14

**Integrated source inspected:** `origin/release/0.1.0-r2` at
`4024addc4902cd019b64df548e4fb2dbf84cd053`.

**Staging note:** this TDD branch contains the prior Luna-C packet history and
has unrelated staging drift from the integrated release (#191/#196/#177
FileManager/windowing work). The target production files for these five Issues
are unchanged between this branch and `4024add`; no target gate was run against
an unmerged implementation branch. The planning branch was refreshed with
`origin/planning/release-0.1.0-r2-tdd` before this audit.

**Active ownership check:** GitHub Issues #64, #113, #114, #123, and #124 are
open and unassigned. `gh pr list --state all --search "#N"` found no active
implementation PR for any of the five. The only related merged editor PR is
#131, already integrated before this audit.

## Current disposition matrix

| Issue | prior blocker | current truth | queue result |
|---|---|---|---|
| #64 | generic HARNESS GAP / missing js-dos save API | **Still missing product/runtime seam.** `JsDosPlayerHandle` exposes only `stop()`. `JsDosPlayer` passes `autoSave: false`; no supported `ci.persist`, `fsChanges`, export, import, save event, or stable save-result callback is exposed by `runtime.ts` or the host. Current lifecycle is FsService read -> Blob URL -> Dos -> ready -> stop/revoke. No truthful save/restore RED can be written without guessing the shipped 8.4.1 bundle API. | Remains `[~]`; exact missing production seam, not a fake Testing helper. |
| #113 | core RED plus Happy DOM Monaco startup gap | **Product RED remains and shared harness gap remains.** `TextEditor.tsx` still sets the process title to the filename only; it exposes the `Monaco ready` badge; there is no visible language indicator, minimap, or command affordance. `MonacoEditorSurface` still starts real Monaco asynchronously. Current canonical `setupHappyDom.ts` installs no `CSS`; direct probe reports `CSS` and `CSS.escape` as `undefined`. Real Monaco startup therefore cannot be mounted truthfully through the current RTL adapter. No production or Testing change has repaired this. | Remains `[~]`; category A shared RTL gap plus product RED/browser boundary. |
| #114 | core RED plus same Happy DOM Monaco startup gap | **Product RED remains; Markdown renderer is already green.** `MarkdownEditor.tsx` still has Edit/Split/Preview and Save, but no formatter/provider or visible Monaco command menu; title remains filename/Markdown. `render.ts` sanitizer/preview semantics are covered, but they do not prove formatter UI. Canonical RTL has the same missing `CSS.escape` boundary and must not mock Monaco. | Remains `[~]`; category A shared RTL gap plus product RED/browser boundary. |
| #123 | missing game-artwork metadata contract | **Shared #190 seam now exists, but the required product contract still does not.** `resource-presentation.ts` accepts already-authoritative classification and optional registered artwork; it has no game-artwork metadata source, provenance, stable identity/copy policy, byte envelope, or size rule. `resourcePolicy.ts` has no game-artwork field. Existing `rom-game.svg` is a generic asset candidate, not canonical metadata. A RED choosing its key or semantics would invent the product contract. | Remains `[~]`; exact missing product contract, not a Testing gap. |
| #124 | waits for #64 save artifact/boundary | **Dependency is still absent.** Generic Visual thumbnail primitives/assets exist, but no js-dos save result, stable save resource identity, explicit successful save boundary, frame capture hook, or non-authoritative preview association exists. #64 cannot currently provide the authority to which a screenshot could attach. | Remains `[~]`; exact dependency on #64, no speculative RED. |

## Evidence commands and results

Executed against the current worktree:

```text
cd apps/plasmon && bun -e 'await import("./test/setupHappyDom.ts"); console.log("CSS", typeof globalThis.CSS, "escape", typeof (globalThis as any).CSS?.escape)'
CSS undefined escape undefined

cd apps/plasmon && bun test \
  src/native-apps/jsdos/jsdos.test.ts \
  src/native-apps/text/monacoAdapter.test.ts \
  src/native-apps/text/document.test.ts \
  src/native-apps/markdown/markdown.test.ts \
  src/os/visual/issue-190.test.ts
27 pass, 0 fail
```

The focused green tests characterize existing authority only: js-dos
association/transport/stop lifecycle, Monaco model/language/worker-label policy,
document save/close semantics, Markdown sanitization/modes, and #190 shared
presentation. They do not establish any of the five missing contracts.

## Why no new RED was promoted

- **#64:** a test would need an API the shipped host does not expose. A cast,
  guessed js-dos method, mocked Dos handle, or browser-local persistence would
  be false production evidence.
- **#113/#114:** the missing product behavior is real, but the canonical RTL
  route cannot start the real Monaco engine. A source-string assertion or a
  mocked Monaco module would not be the requested React/engine acceptance. The
  remaining Monaco/Worker behavior belongs to the installed browser lane.
- **#123:** #190 made consumption possible, not the game metadata contract.
  Selecting a metadata key or fixture convention in a RED would decide product
  behavior without an accepted authority.
- **#124:** without #64's save result and boundary, a screenshot test would
  invent save identity and could accidentally make preview bytes authoritative.

## Exact handoff vocabulary

### Testing / Integration Lead — category A only

For #113 and #114, provide one shared vocabulary for the non-engine portion of
Text/Markdown RTL acceptance or explicitly route the Monaco-dependent portion to
packaged Playwright:

- mount the real production app path without replacing Monaco;
- inspect semantic title/language/command/formatter/status controls where the
  browser engine is not required;
- preserve a separate installed proof for real Monaco readiness, Worker
  startup/communication, focus, minimap, and editor command interaction.

Do not add `CSS.escape` as a test-only polyfill and call Monaco ready. Do not
change `renderPlasmon()` into a Monaco mock.

### Future js-dos/runtime owner — #64

Inspect the exact shipped js-dos 8.4.1 archive and expose a supported bounded
save/restore seam: authoritative source NodeId, explicit successful save result,
restore input, failure/corruption behavior, and lifecycle timing. Then add the
lowest deterministic FsService/adapter RED/GREEN coverage and a real packaged
runtime proof. Until then #64 remains `[~]`.

### Games/Visual contract owner — #123

Decide the canonical game-artwork metadata key/type, provenance/source,
identity behavior across rename/copy, package/filesystem authority, size/MIME
limits, and fallback semantics. Only after that contract is integrated can a
small headless RED exercise #190's shared presentation.

### #124 owner

Wait for #64's accepted save artifact and explicit save boundary. Then prove
screenshot capture is optional/non-authoritative, bounded, associated with
stable save identity, and rendered through #190's shared presentation without
blocking save.

## Stop condition

No truthful gate became executable during this re-audit. All five existing
`[~]` statuses remain justified, but their reasons are current and distinct:
#64 product/runtime seam; #113/#114 shared RTL plus product/browser boundaries;
#123 product contract; #124 #64 dependency. No production code or shared
Testing infrastructure was modified.
