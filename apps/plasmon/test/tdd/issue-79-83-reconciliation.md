# #79 / #83 reconciliation

Audit base: integrated `origin/release/0.1.0-r2` (`2b6984e...`) after the
accepted #189/#190 work. Both previously unclaimed surfaces are already covered
by truthful production tests; no additional RED is warranted.

## #83 — ALREADY GREEN / RECON COMPLETE

`test/emulatorJsRuntime.test.ts`, `src/native-apps/jsdos/jsdos.test.ts`,
`src/native-apps/emulatorjs/emulatorjs.test.ts`, `src/games/demoFixture.test.ts`,
and `test/refactorGuards.test.ts` compose the real production
`HandlerAssociationRegistry`, filesystem/open dispatcher, `IntegratedOpenService`,
`NativeProcessController`, and `NativeWindowManager`.

The existing coverage proves:

- `.jsdos` and renamed `.JSDOS` resolve to `runtime:js-dos`;
- `.nes` and renamed `.NES` resolve to `runtime:emulatorjs`;
- representative runtime resources create the expected Process/Window host;
- stable NodeId is retained through open;
- runtime-only definitions do not create `.sys` applications;
- selection is association-driven, not title/game-name dispatch;
- closing the host removes Process and Window state;
- actual runtime startup/canvas/WASM/iframe behavior remains packaged-browser
  acceptance, not a headless claim.

An explicit temporary `.red/issue-83.red.test.ts` duplicate was run and passed,
then removed because it added no stronger contract than the existing permanent
tests.

## #79 — ALREADY GREEN / RECON COMPLETE

`src/os/process/process.test.ts` proves Process close allow/prevent/defer,
repeated-close protection, completion/cancellation, window-originated close,
forced close, and cleanup. `src/native-apps/text/documentClose.test.ts` proves
Text/Markdown-owned dirty Save/Discard/Cancel semantics, autosave suspension,
failed-save retention, and unresolved conflict behavior. The existing
`DocumentCloseModel` is the application decision authority; Process owns the
request and Windowing owns the window lifecycle.

The accepted headless composition in `test/associationOpenComposition.test.ts`,
`test/fileManagerActivation.test.ts`, `test/resourceOpenCrossSurface.test.ts`,
and `test/refactorGuards.test.ts` additionally proves production resource open,
Process/Window synchronization, and no orphan after close. A temporary
`.red/issue-79.red.test.ts` was run and passed, then removed because it used an
artificial close handler and could not prove the mounted React document model;
it was weaker than the existing production-layer tests.

The remaining real browser boundary is the visible close-button/dialog adapter
and Monaco/document host rendering. That does not justify a duplicate headless
RED for #79.

## Ownership / boundary

No production code was changed. No alternate process/window/runtime model was
introduced. #79/#83 are classified **ALREADY GREEN / RECON COMPLETE** on their
truthful deterministic contracts, with browser runtime/visible interaction
remaining separate acceptance where applicable.
