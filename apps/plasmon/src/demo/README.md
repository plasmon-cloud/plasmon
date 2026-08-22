# Plasmon demo deployment content

This directory owns non-game content enabled by the Plasmon `demo` package profile.

## Demo content

`npm run plasmon:demo:prepare` is the canonical demo preparation command. The deployment coordinator packages Plasmon through its normal `package` script while selecting the repository's existing `demo` package profile internally.

There is no separate first-demo mode, fixture flag, browser query, or extra Plasmon packaging command. Ordinary `npm --workspace neutron-plasmon run package` and the bounded `plasmon:local:*` deployment remain non-demo by default.

The content is expressed as ordinary `FilesystemSeedSpec` entries with `seedClass: "demo-temporary"`. `createPlasmonServices()` passes them to the normal filesystem core, and `bootstrapFilesystem()` / `reconcileSeedManifest()` create them through `FsService` primitives. After the files exist, `reconcileDemoDesktopShortcuts()` resolves their stable NodeIds and reconciles three shared Desktop shortcut seeds through the same filesystem seed authority.

Current authored resources are:

- `/Documents/Demo Notes.txt` — `text/plain`;
- `/Documents/Demo Guide.md` — `text/markdown`;
- `/Pictures/Demo Artwork.svg` — `image/svg+xml`.

A fresh demo filesystem also receives one `/Desktop` shortcut to each resource. Those shortcuts use canonical shared shortcut metadata with stable NodeId targets.

All text and SVG bytes are authored directly in this repository for the Plasmon demo environment. They contain no third-party media payloads and require no external download or license grant.

Game/demo-runtime fixtures are deliberately not owned here. Issue #121 retains separate game/runtime fixture ownership.
