# js-dos runtime host

This directory integrates js-dos as an association-backed optional content runtime. Runtime selection is independent from the Slim/Base package tier and from Demo content. Game bundles remain ordinary filesystem resources opened through AssociationRegistry/OpenService; this directory must not become a game-name dispatcher or parallel application catalog.

`runtime.ts` owns browser-side runtime loading, global readiness, packaged asset URLs, and the embedded volatile storage-compatibility lease. `JsDosPlayer.tsx` owns the rendered player surface and save-before-close lifecycle. `progress.ts` owns durable js-dos change-set persistence through canonical Plasmon filesystem state. Handler/application metadata is exported through `index.ts` and registered by OS integration only when js-dos is selected.

## Runtime selection and package boundary

The canonical optional-runtime catalog pins js-dos as:

- runtime ID: `js-dos`;
- version/revision: `8.4.1` / `v8.4.1`;
- source: `https://github.com/caiiiycuk/js-dos/releases/download/v8.4.1/release.zip`;
- integrity: `sha256-JhGGkruxgK7HjsFpfrHqayj/QQEBhwz6PmgwmRTH6qY=`;
- delivery: preparation-time acquisition into the content-addressed runtime cache, followed by runtime-consumer materialization.

Base with runtime configuration `none` contains no js-dos runtime payload and does not register `runtime:js-dos`. A Base package can select only js-dos with:

```sh
PLASMON_PACKAGE_PROFILE=base PLASMON_RUNTIME_CONFIGURATION=js-dos npm run package
```

The built-in `js-dos` selection and any custom configuration containing `js-dos` resolve through the same canonical runtime definition. Runtime configuration does not add another `PLASMON_PACKAGE_PROFILE` value.

Slim cannot select js-dos. Any non-empty runtime selection is rejected before runtime acquisition/materialization, preserving the strict Slim package boundary.

## Installed package transport

When selected, preparation verifies the pinned release archive before `jsDosRuntimeMaterializer.ts` extracts exactly the catalog-declared runtime assets:

- `js-dos.js`;
- `js-dos.css`;
- `emulators/emulators.js`;
- `emulators/wdosbox.js`;
- `emulators/wdosbox.wasm`.

The materializer emits the same verified bytes beneath logical managed authority `/System/Program Files/js-dos` and the package-local browser transport `runtime/jsdos/`. Installed browser execution requests only the package-local transport; it never uses a mutable external runtime origin or performs first-use executable download.

The preparation cache is build/deployment state, not user configuration or save state. Cached archives are reverified before use; offline preparation requires a valid cached artifact.

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

The preview lifecycle is presentation-only: one preview is retained per save, save correctness never reads preview bytes, and preview publication failure cannot invalidate a successful progress save.

## Acceptance fixture

The packaged browser acceptance may explicitly include the repository-authored `Plasmon Demo.jsdos` fixture without making that fixture normal Base or Demo content. The fixture contains no third-party game data. It creates `SCORE.DAT` only after receiving SPACE, so closing and reopening the same filesystem NodeId can prove that real keyboard input produced engine state which was saved through `FsService` and consumed on restore.

The specialist browser acceptance also verifies that every required runtime asset is requested from the installed `runtime/jsdos/` package path, the real js-dos readiness event is reached, a visible non-zero canvas exists, save-before-close completes, and the same NodeId restores progress. No fixed sleeps or browser-local durable save authority are used for that proof.

## Testing

Use fast tests for registration/configuration, stable NodeId progress mapping, corruption/version fallback, embedded storage compatibility, preview metadata/lifecycle, shared preview loading, and deterministic helpers. Use package/browser tests only for claims that require installed assets and a real browser engine: runtime asset delivery, global initialization, canvas/input behavior, save-before-close, reopen/restore, sandbox compatibility, and playable startup.
