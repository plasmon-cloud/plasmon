# EmulatorJS runtime host

<!-- plasmon-docs-review:v1 sha256=ac347964fea97faa7cc9b26c0ef82799b047b8b34bfddd14558c3a8816b9bc62 base=2f895e1b9df52cd127020356f00989dc08c8a25e -->

This directory integrates EmulatorJS as an association-backed Plasmon runtime.
Every shipped Plasmon package profile omits this optional runtime and its ROM
payload; this source remains deferred runtime/test evidence rather than a
package request path. It is a runtime host, not a Games launcher or a `.sys`
application.

The initial supported resource is an iNES `.nes` ROM. Association matching selects `runtime:emulatorjs`; the normal OpenService, process, and window authorities create the host. `EmulatorJsPlayer.tsx` reads and validates the selected filesystem node through `FsService`, then gives the ROM bytes to an isolated child iframe running the packaged EmulatorJS browser engine.

## Runtime assets and lifecycle

No shipped package profile registers EmulatorJS or materializes
`/System/Program Files/EmulatorJS` or `/runtime/emulatorjs/data/`, so missing
runtime requests cannot occur in an installed package.

The iframe navigates to the package-local `emulatorjs-host.html`; that child host loads `emulatorjs-host.js`, creates the ROM Blob URL in its own browsing context, sets the `EJS_*` globals, and injects `/runtime/emulatorjs/data/loader.js`. `EJS_pathtodata` points at that same package-local URL-safe mirror, so EmulatorJS JavaScript, CSS, fceumm core data, compression worker, and optional core report all resolve from the installed package without remote fallback.

EmulatorJS 4.2.3 uses browser-global `EJS_*` configuration. Each process therefore gets its own iframe so runtime globals, WASM, audio, timers, and engine state remain isolated per native window. Plasmon does not inspect or mutate the iframe document: Neutron can isolate the outer application browsing context, so direct `contentDocument` access is not a valid runtime contract. Instead, the parent and packaged child exchange token-validated `postMessage` lifecycle messages. The child reports `loaded` only from the real `EJS_ready` callback and `ready` only from the real `EJS_onGameStart` callback; tests must not synthesize those states.

The full optional profile keeps the approved daedalOS-style one-iframe-per-
runtime-instance boundary while adapting bootstrap to Neutron's application
isolation and app-host routing. Required EmulatorJS scripts, styles, fceumm
core data, and the generated proof ROM remain package-local. Do not replace the
real child runtime with a test-only frame, readiness flag, filename dispatch,
or generic emulator framework.

Unmounting the host sends a terminate command to the exact child runtime and removes its iframe. No shared emulator framework is introduced.

The host disables EmulatorJS local settings/database caches where the public configuration supports it. Plasmon's filesystem remains authoritative for the ROM resource and any durable product state. Neutron's outer application sandbox remains `allow-scripts` with an opaque origin: the host does not add `allow-same-origin` merely to satisfy runtime probes. Because EmulatorJS 4.2.3 probes localStorage/IndexedDB despite its disable flags, the child shadows those browser-persistence capabilities as unavailable before loading upstream code.

RetroArch's Emscripten platform layer also treats Screen Wake Lock as optional. Neutron intentionally does not delegate that permission to the sandboxed application document, while Chromium can still expose `navigator.wakeLock` and reject `request("screen")` by permissions policy. The child therefore masks only that denied capability before EmulatorJS loads, allowing the runtime's normal no-wake-lock fallback. Do not grant `screen-wake-lock`, weaken the Kernel sandbox, or fabricate a successful wake-lock object for this runtime.

## Saves

The legal packaged acceptance ROM is a generated mapper-0 NES test image with no battery-backed save RAM, so this first runtime proof intentionally does not claim durable save-file support. EmulatorJS exposes save callbacks, but its engine also has browser-side save internals. Before Plasmon advertises durable saves for save-producing ROMs, those bytes must be bridged explicitly through `FsService`; browser storage must not become authoritative user state.

## Testing

Use fast Bun tests for `.nes` association matching, ROM validation, URL-safe package-relative browser resolution, and the canonical headless filesystem -> association -> OpenService -> process/window path. Package acceptance verifies the managed Program Files assets and URL-safe browser mirror are byte-identical and verifies the production child host keeps persistence and Screen Wake Lock unavailable without granting sandbox permissions. Use the packaged browser lane only to prove the installed child host boots, the actual package-local loader/core starts the generated NES fixture, no required runtime asset leaves the package, and iframe teardown works in a real browser.
