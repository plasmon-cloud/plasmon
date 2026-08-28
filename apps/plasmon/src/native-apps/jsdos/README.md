# js-dos runtime host

This directory integrates the js-dos browser runtime and player as an
association-backed content runtime. Every shipped Plasmon package profile
omits this optional runtime and its game payload; this source remains deferred
runtime/test evidence rather than a package request path.

`runtime.ts` owns browser-side runtime asset loading, global readiness, loader caching/retry, runtime configuration, and the embedded-only volatile storage compatibility lease. `JsDosPlayer.tsx` owns the rendered game/runtime surface. `progress.ts` owns the durable js-dos change-set mapping onto canonical Plasmon filesystem state. Handler/application metadata is exported through `index.ts` and registered by OS integration.

Game bundles/content are data selected through the normal association/opening path. This directory should not become a game-name dispatcher or a parallel application catalog.

## Installed package transport

No shipped package profile registers js-dos or materializes
`/System/Program Files/js-dos` or `runtime/jsdos/`. The source remains available
for direct runtime tests, while opening a game in an installed package cannot
create a missing-runtime request.

## Embedded storage compatibility

js-dos 8.4.1 unconditionally uses `navigator.storage.estimate()` and OPFS for its internal bundle/local-change caches. Installed Plasmon intentionally runs inside an opaque sandboxed Neutron app frame, where Chromium exposes those APIs but rejects them.

The runtime host therefore supplies a volatile in-memory StorageManager/OPFS subset only while embedded js-dos players are active. This adapter exists solely to satisfy js-dos' engine-internal cache/bootstrap contract without weakening the sandbox. It is shared across concurrently open js-dos players, restored after the last player closes, and is intentionally non-durable.

Do not treat that compatibility adapter as Plasmon game-save authority. Browser OPFS, IndexedDB, localStorage, and this volatile adapter must not become a second durable source of truth.

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

The hidden progress directory is ordinary Plasmon filesystem state behind the normal durable filesystem service/repository boundary. It is distinct from the embedded volatile StorageManager adapter: the latter exists only for engine-internal cache/bootstrap compatibility and never becomes save authority.

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

Use fast tests for registration/configuration, stable NodeId progress mapping, corruption/version fallback, embedded storage compatibility, preview metadata/lifecycle, shared preview loading, and deterministic helpers. Use package/browser tests for script/style asset presence, runtime global initialization, failure/retry, canvas/input behavior, real save-before-close, screenshot capture/presentation, reopen/restore, sandbox storage compatibility, and actual playable startup because those claims depend on a browser engine and packaged assets.
