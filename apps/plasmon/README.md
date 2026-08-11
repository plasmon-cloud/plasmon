# Plasmon 0.1.0

Plasmon is a Neutron-native application launcher. It is intentionally a normal `.neutron` app rather than a replacement Kernel: Neutron keeps app isolation, tile/window ownership, authorization, and installation review while Plasmon provides the user-facing launcher experience.

This app was bootstrapped from Neutron's `apps/hello` application on the upstream `dev` branch. The separate `init` branch preserves that Hello-derived baseline.

## Setup and verification

From the repository root:

```sh
npm install
cd apps/plasmon
npm test
npm run package
```

`npm test` already executes the official Neutron package pipeline before Bun tests:

```text
validate -> frontend build/mogen -> mopack -> method schema -> pack -> Bun tests
```

The expected archive is:

```text
plasmon.v0.1.0.neutron
```

## Fast UI development

The launcher has a standalone preview mode specifically so UI work does not require rebuilding or starting the Neutron Kernel:

```sh
cd apps/plasmon
npm run dev
```

Then open:

```text
http://localhost:5173
```

Standalone mode uses mock installed-app metadata. Production Neutron mode is selected automatically when Plasmon runs in a Kernel-owned app frame.

`npm run watch` remains available when only rebuilding the production frontend files is useful.

## Run inside local Neutron

The repository-root `plasmon.ndeploy.json` is intentionally small. It installs only Hello as a control application and Plasmon as the launcher. Make sure the referenced Kernel, Hello, and Plasmon archives exist, then use Neutron's normal provisioner flow from the repository root:

```sh
npm run provision -- plasmon.ndeploy.json serve
```

Keep that process running. In another terminal:

```sh
npm run provision -- plasmon.ndeploy.json reinstall
npm run provision -- plasmon.ndeploy.json status
```

Open the node URL printed by `status`. The provisioner consumes archives; it does not build the app workspaces for you.

## 0.1.0 behavior

When running inside vanilla Neutron, Plasmon uses only Kernel-provided app tools:

- `apps.list` discovers installed app ids.
- `apps.describe` reads safe app and tile metadata.
- `workspace.open_tile` opens/focuses the real outer-Kernel app tile.
- `apps.install_offer` hands a `.neutron` package URL to the native owner review flow.
- `tools.list` is used for capability discovery.

Plasmon never embeds another Neutron application as a child iframe and never bypasses the Kernel installer.

If one installed app cannot be described, Plasmon keeps the rest of the launcher usable and renders that app as non-launchable instead of failing all discovery.

The launcher deliberately does not assume access to another app's static asset paths or icons. Vanilla `apps.describe` exposes safe metadata and launch targets, so Plasmon renders its own launcher glyphs.

Plasmon 0.1.0 has no borrowed `update_source`; updates are manual until Plasmon operates an update source of its own.

## Atoms and sharing

The Atoms and Shared sections establish the product model without claiming functionality vanilla Neutron does not provide yet.

An Atom is intended to be an independently named, openable, and shareable object produced by an Atom-aware application. A future app-level tool contract can expose operations such as:

```text
atoms.list
atoms.create
atoms.describe
atoms.share
```

On vanilla Neutron, an Atom is logically isolated by its owning app; 0.1.0 does not claim per-Atom physical AppScope isolation.

## Capability-based evolution

Plasmon does not detect a branded runtime name. It inspects Kernel tools. The current adapter treats the presence of both `apps.catalog` and `apps.allocate` as a future tenant-capable runtime extension. Until those generic tools exist, the same package operates as a vanilla Neutron launcher.

## Branches

- `dev` — untouched Neutron upstream-development baseline.
- `init` — Hello-derived Plasmon app/package baseline.
- `version-0.1.0` — first Plasmon launcher implementation.

The inherited `hello_world` backend remains for this initial version as a known-good Neutron packaging/runtime smoke path. It can be removed or replaced only after the launcher baseline is proven locally.
