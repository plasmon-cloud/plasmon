# Plasmon demo deployment content


This directory owns non-game content enabled by the Plasmon `demo` package profile.

## Demo content

`npm run plasmon:demo:prepare` is the canonical demo preparation command. The deployment coordinator packages Plasmon through its normal `package` script while selecting the repository's existing `demo` package profile internally.

There is no separate demo sub-mode, fixture flag, browser query, or extra Plasmon packaging command. Ordinary `npm --workspace neutron-plasmon run package` and the bounded `plasmon:local:*` deployment remain non-demo by default.

The source payloads are real repository files under `assets/`:

- `assets/Demo Notes.txt` → `/Documents/Demo Notes.txt` — `text/plain`;
- `assets/Demo Guide.md` → `/Documents/Demo Guide.md` — `text/markdown`;
- `assets/Demo Artwork.svg` → `/Pictures/Demo Artwork.svg` — `image/svg+xml`.

For the `demo` package profile, `build.ts` reads those files and embeds their exact UTF-8 contents into the packaged frontend. `demoContent.ts` converts those packaged contents to ordinary `FilesystemSeedSpec` entries with `seedClass: "demo-temporary"`; it does not maintain separate inline Markdown or SVG representations.

`createPlasmonServices()` passes the seeds to the normal filesystem core, and `bootstrapFilesystem()` / `reconcileSeedManifest()` create them through `FsService` primitives. After the files exist, `reconcileDemoDesktopShortcuts()` resolves their stable NodeIds and reconciles three shared Desktop shortcut seeds through the same filesystem seed authority.

A fresh demo filesystem therefore receives one `/Desktop` shortcut to each resource. Those shortcuts use canonical shared shortcut metadata with stable NodeId targets.

The Markdown file contains representative headings, lists, a task list, a table, a blockquote, and a fenced code block. The SVG is a standalone vector document with XML/SVG metadata, title/description, gradients, geometry, and text; it contains no embedded raster or external resource dependency.

All three assets are authored directly in this repository for the Plasmon demo environment and require no external download or license grant.

Game/demo-runtime fixtures are deliberately not owned here. Issue #121 retains separate game/runtime fixture ownership.
