# js-dos runtime host

This directory integrates the packaged js-dos browser runtime and player as an association-backed content runtime.

`runtime.ts` owns browser-side runtime asset loading, global readiness, loader caching/retry, and runtime configuration. `JsDosPlayer.tsx` owns the rendered game/runtime surface. Handler/application metadata is exported through `index.ts` and registered by OS integration.

Game bundles/content are data selected through the normal association/opening path. This directory should not become a game-name dispatcher or a parallel application catalog.

## Installed package transport

`/System/Program Files/js-dos` remains the logical managed runtime authority. The packaged build also mirrors the same pinned js-dos release under `runtime/jsdos/` for browser execution. Installed Kernel app-host delivery of the Program Files path can be blocked by browser ORB when those responses are consumed as script/style resources, so `runtime.ts` resolves only browser-executable js-dos assets through the URL-safe transport mirror. The mirror is derived from the same pinned release digest and must not become a second runtime authority.

## Refactor direction

Keep runtime loading/configuration independent of file association and process/window policy. If additional emulators/runtimes are added, prefer a reusable packaged-runtime host abstraction while allowing each runtime to own its genuine engine-specific lifecycle.

## Testing

Use fast tests for registration/configuration and deterministic helpers. Use package/browser tests for script/style asset presence, runtime global initialization, failure/retry, canvas/input behavior, and actual playable startup because those claims depend on a browser engine and packaged assets.
