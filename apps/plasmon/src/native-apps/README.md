# Plasmon native applications and runtime hosts

`native-apps/**` contains applications rendered through Plasmon's native process/window system plus association-backed browser/runtime hosts.

## Registration and boundaries

`content-apps.ts` defines shared built-in application metadata, handlers, and association rules. Integration registers those definitions with the native application and association registries. Individual apps should not create hidden parallel registries or own generic file-opening policy.

Native application UI consumes the same OS authorities as other surfaces:

- filesystem content through `FsService`;
- handler/default selection through associations/opening services;
- lifecycle/windows through process/window services;
- common resource/application presentation through the shared visual system;
- Kernel application behavior through the Neutron boundary rather than local emulation.

An association-backed runtime host can use a native process/window without automatically becoming a first-class user-launchable system application. Product identity and execution mechanism are separate concerns.

## Application families

- `browser/` — web URL/browser surface.
- `explorer/` — native Explorer wrapper around shared FileManager behavior.
- `text/` — Monaco-backed text/code editing and document sessions.
- `markdown/` — Markdown editing plus sanitized preview on shared editor/session infrastructure.
- `photos/` — browser-supported image viewing/navigation/fullscreen.
- `video/` — browser media playback and URL/media capability handling.
- `settings/` — settings/status surface over injected shared services.
- `properties/` — native wrapper for shared filesystem/resource inspection.
- `recycle-bin/` — native restore/permanent-delete/empty surface over the canonical filesystem Trash service.
- `jsdos/` — association-backed packaged runtime/player integration.

## Package structural coverage

`packaging.ts` validates the esbuild metafile for the accepted user-launchable first-party native app component inputs: Text, Markdown, Photos, Video, Browser, Settings, Explorer, Properties, and Recycle Bin. The assertion searches the complete build graph rather than depending on generated chunk filenames, so eager and dynamically imported loaders remain covered without freezing bundler output naming.

This structural check proves that required application code is represented in the package build graph; it does **not** prove application UI behavior, browser APIs, focus/input behavior, or successful user interaction. Those claims remain in focused/headless/browser/manual layers as appropriate. Runtime-only hosts such as js-dos are not treated as launchable native apps by this package inventory; js-dos keeps its dedicated pinned packaged-runtime asset contract.

## Refactor direction

Build reusable application infrastructure instead of solving the same document/media/runtime problem in each app. Prefer shared document sessions/editor chrome, common media/object-URL helpers, reusable navigation models, shared settings capability seams, and consistent application chrome/presentation.

Keep domain semantics below React when they can be deterministic. Browser engine adapters (Monaco, media elements, iframes, fullscreen, packaged scripts/workers) should remain isolated from filesystem/document/domain policy.

Concrete titles, menu omissions, file-type corrections, runtime paths, and current acceptance bugs belong in Issues/tests, not in this overview.

## Testing

Use fast model/domain tests for document sessions, parsing/classification, navigation, settings summaries, URL/media normalization, Trash-surface actions, and other deterministic semantics. Use real-browser/package tests for Monaco/workers, iframe/media behavior, fullscreen, object URLs, packaged runtime scripts/assets, native application rendering, focus/keyboard integration, and other browser-engine behavior. Manual review remains useful for application UX/polish.
