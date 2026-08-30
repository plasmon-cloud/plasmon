# Plasmon Demo deployment content

This directory owns non-game content enabled by the Plasmon **Demo overlay**.

## Demo content

`npm run plasmon:demo:prepare` is the canonical Demo preparation command. The deployment coordinator packages Plasmon as the ordinary **Base** tier and enables `PLASMON_DEMO_OVERLAY=1` for Plasmon while also packaging every sibling `.neutron` application declared by `plasmon.ndeploy.json`.

Demo is not a third package tier. Ordinary `npm --workspace neutron-plasmon run package` and the bounded `plasmon:local:*` deployment build Base without Demo content by default. Slim remains a separate explicit constrained tier and cannot enable the Demo overlay.

The source payloads are real repository files under `assets/`:

- `assets/Demo Notes.txt` → `/Documents/Demo Notes.txt` — `text/plain`;
- `assets/Demo Guide.md` → `/Documents/Demo Guide.md` — `text/markdown`;
- `assets/Demo Artwork.svg` → `/Pictures/Demo Artwork.svg` — `image/svg+xml`.

When the Demo overlay is enabled, `build.ts` reads those files and embeds their exact UTF-8 contents into the packaged Base frontend. `demoContent.ts` converts those packaged contents to ordinary `FilesystemSeedSpec` entries with `seedClass: "demo-temporary"`; it does not maintain separate inline Markdown or SVG representations.

`createPlasmonServices()` passes the seeds to the normal filesystem core, and `bootstrapFilesystem()` / `reconcileSeedManifest()` create them through `FsService` primitives. After the files exist, `reconcileDemoDesktopShortcuts()` resolves their stable NodeIds and reconciles three shared Desktop shortcut seeds through the same filesystem seed authority.

A fresh Demo filesystem therefore receives one `/Desktop` shortcut to each resource. Reconciliation is idempotent: repeated reconciliation retains exactly one canonical shortcut per resource. Those shortcuts use canonical shared shortcut metadata with stable NodeId targets.

The Markdown file contains representative headings, lists, a task list, a table, a blockquote, and a fenced code block. The SVG is a standalone vector document with XML/SVG metadata, title/description, gradients, geometry, and text; it contains no embedded raster or external resource dependency.

All three assets are authored directly in this repository for the Plasmon Demo environment and require no external download or license grant.

Game/Demo-runtime fixtures are deliberately not owned here. Current game/runtime fixture authority lives in [`../games/README.md`](../games/README.md) and the owning runtime documentation under [`../native-apps/`](../native-apps/).
