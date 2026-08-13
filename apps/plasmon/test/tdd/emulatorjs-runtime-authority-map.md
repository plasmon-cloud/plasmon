# EmulatorJS runtime authority map

FsNode `.nes` bytes -> canonical MIME/classifier -> `runtime:emulatorjs`
AssociationRegistry -> OpenService -> NativeProcessController -> WindowManager
-> `EmulatorJsPlayer` -> package-local `emulatorjs-host.html` iframe ->
postMessage token -> actual EmulatorJS loader/core/WASM/canvas.

Logical authority: `/System/Program Files/EmulatorJS`; executable transport:
`./runtime/emulatorjs/data/`; child host owns EJS globals. ROM Blob URL is
transient and revoked by child terminate. Browser localStorage/IndexedDB and
wake lock are deliberately masked; no same-origin grant. Parent trusts only
real `EJS_ready`/`EJS_onGameStart` messages. No `.sys` runtime wrapper.
