# Plasmon explicit demo fixtures

This directory owns non-game content used only by explicit Plasmon demo and acceptance runs.

## First-demo fixture

`firstDemoFixture.ts` enables its content only when the installed Plasmon document is launched with:

```text
?plasmon-fixture=first-demo
```

Normal production URLs return no first-demo seeds and therefore do not create these resources.

The fixture is expressed as ordinary `FilesystemSeedSpec` entries with `seedClass: "demo-temporary"`. `createPlasmonServices()` passes them to the normal filesystem core, and `bootstrapFilesystem()` / `reconcileSeedManifest()` create them through `FsService` primitives. FileManager, Search, associations, and native applications receive no fixture-specific opening behavior.

Current authored resources are:

- `/Documents/First Demo Notes.txt` — `text/plain`;
- `/Documents/First Demo Guide.md` — `text/markdown`;
- `/Pictures/First Demo Artwork.svg` — `image/svg+xml`.

All text and SVG bytes are authored directly in this repository for Plasmon acceptance use. They contain no third-party media payloads and require no external download or license grant.

Game/demo-runtime fixtures are deliberately not owned here. `src/games/demoFixture.ts` and Issue #121 retain the separate `plasmon-fixture=demo-game` path and `/Games` ownership.
