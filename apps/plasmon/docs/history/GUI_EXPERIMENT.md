# Plasmon GUI experiment

Branch: `version-0.1.0-gui`

This branch is a deliberately isolated experiment in presenting Plasmon as a familiar desktop environment while keeping Neutron as the actual runtime and security boundary.

## What is implemented

- Installed Neutron apps are discovered dynamically from the existing Plasmon platform adapter.
- Every discovered app appears automatically as a desktop shortcut.
- Discovered apps also appear as pinned launchers in the Plasmon taskbar.
- Double-clicking a Neutron app desktop shortcut calls the normal Kernel `workspace.open_tile` path. The app therefore remains a real authenticated Neutron tile rather than an unsafe nested iframe.
- The desktop includes a Start/search menu, clock, context menus, notifications, and a Plasmon-branded wallpaper.
- Plasmon-owned demo programs run as movable/resizable/minimizable/maximizable windows inside the Plasmon tile:
  - Plasmon Control
  - Atoms explorer
  - Notes
  - Terminal
  - Calculator
  - About
- The Atoms explorer intentionally presents logical Atoms as files and includes a right-click `Share…` affordance. Sharing is a UI preview only; no Atom sharing contract is invented by this branch.
- The existing Kernel-owned install-offer flow remains available through Plasmon Control and Start.

## App icons

Vanilla `apps.describe` currently omits the manifest `tile.icon` path. This experiment therefore probes the conventional first-party Neutron location `static/icon.svg` on the target app's normal isolated app origin and falls back to generated initials if that asset does not exist.

A proper production solution should extend safe app discovery metadata to expose a validated icon reference rather than depending on this convention.

## Important architectural limitation

A real Neutron app cannot currently run as a nested authenticated iframe inside the Plasmon tile. Neutron registers direct Kernel-owned tile frames and gives those frames their private message-bus ports. Nesting another app below Plasmon changes its immediate parent and breaks that trust model.

For this reason the GUI experiment has two kinds of windows:

1. **Plasmon demo windows** — true floating windows inside the Plasmon tile.
2. **Real Neutron apps** — launched through Kernel as sibling Neutron tiles.

The intended future evolution is to move/adapt the floating-window manager into Kernel (or add a Kernel floating workspace mode) so real authenticated `AppTileFrame`s can be rendered with this desktop UX without changing the application security model.

## Keyboard shortcuts inside Plasmon

- `Ctrl+Space` — toggle Plasmon Start.
- `Ctrl+Shift+P` — open Plasmon Control.
- `Escape` — close Start/context menus.

These are scoped to the Plasmon iframe and are separate from Kernel workspace shortcuts.

## Local test

From the repository root:

```sh
npm --workspace neutron-design-system run build
npm --workspace neutron-plasmon test
```

If the existing PocketIC `serve` process is running, then reinstall with the branch's existing deployment configuration:

```sh
npm run provision -- plasmon.ndeploy.json reinstall
npm run provision -- plasmon.ndeploy.json status
```

## Things to evaluate visually

- Does the desktop metaphor make Neutron immediately understandable?
- Is it acceptable that real apps currently open as sibling Kernel tiles?
- Should Plasmon become a Kernel workspace background/shell later instead of an ordinary foreground tile?
- Which daedalOS-style interactions are worth moving into a generic Kernel floating-window mode: z-order, drag/resize, minimize/maximize, snapping, taskbar state, and persisted geometry?
- Should Files-backed documents become the first vanilla-Neutron implementation of logical Atoms?
