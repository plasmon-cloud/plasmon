# EmulatorJS runtime host

This directory integrates EmulatorJS 4.2.3 as an association-backed optional Plasmon runtime. EmulatorJS selection is separate from the Plasmon package tier: ordinary Base with no runtime configuration and Slim contain no EmulatorJS runtime payload, while a Base/custom configuration can select `emulatorjs` and Demo selects it through the canonical `demo-games` runtime configuration. Slim rejects non-empty optional-runtime selections.

The supported resource is an iNES `.nes` ROM. Association matching selects `runtime:emulatorjs`; the normal filesystem, AssociationRegistry, OpenService, Process, and Windowing authorities create the host. `EmulatorJsPlayer.tsx` reads and validates the selected filesystem node through `FsService`, then gives the ROM bytes to an isolated child iframe running the package-local EmulatorJS browser engine. There is no game-title or basename dispatcher.

## Canonical runtime authority

`runtimeConfiguration.ts` is the sole runtime-definition authority. The selected EmulatorJS definition is pinned to:

- runtime id: `emulatorjs`
- version: `4.2.3`
- upstream revision: `e150dc0491ae747028919fb82d6598954976ede6`
- `@emulatorjs/emulatorjs` artifact: `https://registry.npmjs.org/@emulatorjs/emulatorjs/-/emulatorjs-4.2.3.tgz`
- artifact integrity: `sha512-7z3qaA4LwyurhuGvdMUDF9xJpEbxC3SNy9+E9tSaOsRo8FCS2QXam/0k/lc9kqHWRFIlLKWahNjPAStyL0rFnw==`
- `@emulatorjs/core-fceumm` artifact: `https://registry.npmjs.org/@emulatorjs/core-fceumm/-/core-fceumm-4.2.3.tgz`
- core integrity: `sha512-XX9Vv2N/hzp0TstNMCTSppEs+sg+1lpJpPdSDuRqIO/cwdt7dUcF+WjNX1yQJLRbP5+XwcNHZ6K4BKy8CJpndQ==`
- selected NES core: `fceumm`

Required package-local runtime assets are `loader.js`, `emulator.min.js`, `emulator.min.css`, `compression/extract7z.js`, `cores/fceumm-wasm.data`, and `cores/fceumm-legacy-wasm.data`. Preparation uses the generic content-addressed runtime cache, verifies the pinned artifact integrities, and fails closed when required source/core inputs or compatible runtime metadata are missing. EmulatorJS 4.2.3's npm source artifact intentionally omits the generated minified outputs: the runtime materializer therefore derives the package-local `emulator.min.js` deterministically from the verified `data/src` files in the upstream loader's fallback order and emits the verified `data/emulator.css` bytes as `emulator.min.css`. No mutable release/CDN fetch is used to fill those generated filenames. The resulting delivery files are mirrored under managed Program Files and the URL-safe `/runtime/emulatorjs/` browser transport.

Useful package commands are:

```text
npm --workspace neutron-plasmon run package:emulatorjs
npm --workspace neutron-plasmon run test:package:emulatorjs
```

Ordinary Base uses no optional runtime unless `PLASMON_RUNTIME_CONFIGURATION` selects one. Demo uses `PLASMON_RUNTIME_CONFIGURATION=demo-games`, which resolves through the same canonical definitions rather than duplicating EmulatorJS metadata.

## Browser assets and lifecycle

The iframe navigates to package-local `emulatorjs-host.html`; that child loads `emulatorjs-host.js`, creates the ROM Blob URL in its own browsing context, sets the `EJS_*` globals, and injects `/runtime/emulatorjs/data/loader.js`. `EJS_pathtodata` points at the same package-local mirror, so EmulatorJS JavaScript, CSS, fceumm core data, the compression worker, and optional core report remain inside the prepared package authority.

EmulatorJS uses browser-global `EJS_*` configuration. Each Process therefore receives its own iframe so runtime globals, WASM, audio, timers, and engine state remain isolated per native window. Plasmon does not rely on direct `contentDocument` access. The parent and packaged child instead exchange token-validated `postMessage` lifecycle messages. The child reports loaded state from real `EJS_ready` and `game-started` only from real `EJS_onGameStart`; elapsed time or successful requests are not readiness authority.

Unmounting the host sends a terminate command to the exact child runtime and removes its iframe. A second Process receives a separate child iframe and separate runtime globals.

## Sandbox and browser persistence

Neutron's outer application sandbox remains `allow-scripts` with an opaque origin. EmulatorJS restoration does not add `allow-same-origin` or broaden the Kernel sandbox. Because EmulatorJS 4.2.3 probes localStorage and IndexedDB despite disable flags, the child exposes those browser-persistence capabilities as unavailable before upstream code starts. They are not Plasmon persistence authority.

Screen Wake Lock is also optional for the runtime. When Neutron's permissions policy denies it, the child masks the denied capability before EmulatorJS loads so the normal no-wake-lock fallback can proceed. Do not grant `screen-wake-lock`, weaken the sandbox, or fabricate a successful wake-lock object.

## Saves

The deterministic mapper-0 acceptance ROM has no battery-backed save RAM, so this restoration intentionally makes no durable EmulatorJS save-state claim. Any future save-producing ROM must bridge authoritative save bytes explicitly through `FsService`; browser storage must not become durable user-state authority.

## Testing

Fast tests cover `.nes` association matching, iNES validation including malformed/truncated input, deterministic mapper-0 fixture properties, selected/unselected production composition, and the canonical filesystem -> AssociationRegistry/OpenService -> Process/Window path. Package tests verify selected runtime inventory and the managed/URL-safe runtime assets. The Specialist browser lane is reserved for facts that require a real packaged browser: production `game-started` readiness, visible non-zero canvas rendering, approved runtime requests, sandbox/storage compatibility, per-process iframe isolation, and exact iframe teardown. Specialist retries remain zero and readiness uses production-owned events rather than fixed sleeps.
