# js-dos runtime host

This directory integrates the packaged js-dos browser runtime and player as an association-backed content runtime.

`runtime.ts` owns browser-side runtime asset loading, global readiness, loader caching/retry, and runtime configuration. `JsDosPlayer.tsx` owns the rendered game/runtime surface. Handler/application metadata is exported through `index.ts` and registered by OS integration.

Game bundles/content are data selected through the normal association/opening path. This directory should not become a game-name dispatcher or a parallel application catalog.

## Installed package transport

`/System/Program Files/js-dos` remains the logical managed runtime authority. The packaged build also mirrors the same pinned js-dos release under `runtime/jsdos/` for browser execution. Installed Kernel app-host delivery of the Program Files path can be blocked by browser ORB when those responses are consumed as script/style resources, so `runtime.ts` resolves only browser-executable js-dos assets through the URL-safe transport mirror. The mirror is derived from the same pinned release digest and must not become a second runtime authority.

## Durable game progress

Pinned js-dos 8.4.1 exposes a supported `fsChanges` contract with `urlToKey`, `pull`, `push`, and `local` controls plus `player.save()`. Plasmon uses that engine-owned format directly rather than reverse-engineering DOS save files or mutating the original `.jsdos` bundle.

`progress.ts` maps that contract onto the canonical Plasmon `FsService`:

- `fsChanges.local` is always `false`, so js-dos browser-local progress is not a second source of truth;
- the stable game `NodeId` is the progress key; mutable filename, path, and bundle Blob URL are not identity;
- opaque js-dos change bytes are stored under the hidden Plasmon filesystem directory `/.jsdos-progress/`;
- each save record carries format/runtime/integrity metadata and is rejected safely when corrupt or incompatible;
- rename or move keeps the same progress association because the game `NodeId` is unchanged;
- copying a game creates a new `NodeId` and therefore does not silently inherit the original game's progress;
- normal Process close defers while `player.save()` exports current changes. A bounded save timeout cancels that first close and lets the user close again explicitly rather than trapping the process indefinitely.

The hidden progress directory is ordinary Plasmon filesystem state behind the normal durable filesystem service/repository boundary. It is not browser localStorage/IndexedDB/OPFS authority and is not a second emulator database.

The progress file is the accepted durable save representation for the js-dos runtime. Presentation metadata such as future screenshot thumbnails may reference/extend that save record, but preview bytes must never become authoritative for save correctness.

## Refactor direction

Keep runtime loading/configuration independent of file association and process/window policy. If additional emulators/runtimes are added, prefer a reusable packaged-runtime host abstraction only after a second real runtime demonstrates the same lifecycle; do not pre-design a generic emulator save framework from js-dos alone.

## Testing

Use fast tests for registration/configuration, stable NodeId progress mapping, corruption/version fallback, and deterministic helpers. Use package/browser tests for script/style asset presence, runtime global initialization, failure/retry, canvas/input behavior, real save-before-close, reopen/restore, and actual playable startup because those claims depend on a browser engine and packaged assets.
