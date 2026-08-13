# js-dos runtime authority map v2

FsNode `.jsdos` bytes -> AssociationRegistry `runtime:js-dos` -> OpenService ->
Process/Window -> `JsDosPlayer` reads FsService -> Blob URL -> `loadJsDosRuntime`
-> package-local `runtime/jsdos/js-dos.js/css` -> `startJsDosPlayer` -> worker/WASM
emulator assets -> `ci-ready`/`bnd-play` ready -> stop/revoke on close.

Logical managed authority is `/System/Program Files/js-dos`; browser transport is
`./runtime/jsdos/`, byte-derived package mirror. Keyboard Lock is masked only
for synchronous embedded construction. Storage bootstrap errors are #202,
explicit fixture path is #121, durable progress is #64. No `.sys`, remote
runtime, game-name dispatch, or browser-local save authority.
