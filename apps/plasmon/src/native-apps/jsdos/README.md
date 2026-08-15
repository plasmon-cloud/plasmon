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
- opaque js-dos change bytes are stored under the Plasmon filesystem directory `/.jsdos-progress/`;
- each save record carries format/runtime/integrity metadata and is rejected safely when corrupt or incompatible;
- rename or move keeps the same progress association because the game `NodeId` is unchanged;
- copying a game creates a new `NodeId` and therefore does not silently inherit the original game's progress;
- normal Process close defers while `player.save()` exports current changes. A bounded save timeout cancels that first close and lets the user close again explicitly rather than trapping the process indefinitely.

The progress directory is ordinary Plasmon filesystem state behind the normal durable filesystem service/repository boundary. It is not browser localStorage/IndexedDB/OPFS authority and is not a second emulator database.

The `.changes` file is the accepted durable save representation for the js-dos runtime.

## Save screenshot previews

When a live js-dos canvas is available at the normal save-before-close boundary, `preview.ts` captures a bounded PNG frame while `player.save()` persists the authoritative change set. The screenshot is attached only after the save reports success.

The preview lifecycle is deliberately presentation-only:

- at most one sibling `<NodeId>.preview.png` image is retained per js-dos save; a later successful capture overwrites it instead of accumulating snapshots;
- the preview image remains private filesystem state and the canonical `.changes` save record references it through validated `plasmon.resourcePreview` metadata;
- after that canonical reference is written, the same validated preview reference is projected onto the visible game resource so ordinary FileManager/resource surfaces can show the latest saved frame without exposing the progress directory or creating a second save resource;
- both references use the preview resource's stable `NodeId`, not a mutable path;
- failure to project presentation metadata onto the visible game resource is non-authoritative and cannot turn a successful progress save into a failed save;
- capture, canvas encoding, preview write, missing preview data, or image decoding failure never changes save validity or restore behavior;
- FileManager resolves the reference through its existing shared thumbnail/Object-URL lifecycle and falls back normally when the preview cannot be loaded;
- preview bytes are never inspected by `JsDosProgressStore.load()` and are not part of the save checksum/runtime compatibility contract.

This is not a generic screenshot service and does not require every runtime to support capture. js-dos owns the actual canvas capture because it owns that browser/runtime surface; the filesystem/Visual layers own only the bounded preview reference and shared presentation mechanics.

## Refactor direction

Keep runtime loading/configuration independent of file association and process/window policy. If additional emulators/runtimes are added, prefer a reusable packaged-runtime host abstraction only after a second real runtime demonstrates the same lifecycle; do not pre-design a generic emulator save framework from js-dos alone.

## Testing

Use fast tests for registration/configuration, stable NodeId progress mapping, corruption/version fallback, preview metadata/lifecycle, shared preview loading, and deterministic helpers. Use package/browser tests for script/style asset presence, runtime global initialization, failure/retry, canvas/input behavior, real save-before-close, screenshot capture/presentation, reopen/restore, and actual playable startup because those claims depend on a browser engine and packaged assets.
