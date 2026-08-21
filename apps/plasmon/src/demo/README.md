# Plasmon demo deployment content

This directory owns non-game content that is enabled only by the explicit Plasmon demo package profile.

## First demo

`npm run plasmon:demo:prepare` selects the Plasmon `package:demo` command. That command builds with `PLASMON_PACKAGE_PROFILE=demo`; the existing package-profile seam exposes `isDemoProfile` to the installed application, and normal startup contributes the first-demo filesystem seeds only for that profile.

Demo selection is therefore a deployment/build property, not a browser URL or query-parameter property. Ordinary `npm --workspace neutron-plasmon run package` and the bounded `plasmon:local:*` deployment remain non-demo by default.

The content is expressed as ordinary `FilesystemSeedSpec` entries with `seedClass: "demo-temporary"`. `createPlasmonServices()` passes them to the normal filesystem core, and `bootstrapFilesystem()` / `reconcileSeedManifest()` create them through `FsService` primitives. After the files exist, `reconcileFirstDemoDesktopShortcuts()` resolves their stable NodeIds and reconciles three shared Desktop shortcut seeds through the same filesystem seed authority.

Current authored resources are:

- `/Documents/First Demo Notes.txt` — `text/plain`;
- `/Documents/First Demo Guide.md` — `text/markdown`;
- `/Pictures/First Demo Artwork.svg` — `image/svg+xml`.

A fresh demo filesystem also receives one `/Desktop` shortcut to each resource. Those shortcuts use canonical shared shortcut metadata with stable NodeId targets.

All text and SVG bytes are authored directly in this repository for Plasmon demo/acceptance use. They contain no third-party media payloads and require no external download or license grant.

Game/demo-runtime fixtures are deliberately not owned here. Issue #121 retains separate game/runtime fixture ownership.
