# Plasmon GUI experiment

Branch: `version-0.1.0-gui2`

This is the current desktop-environment experiment for Plasmon. It builds on the original GUI experiment and pushes much closer to a polished browser desktop such as daedalOS while retaining Neutron's security boundary.

## Interaction model

- Installed Neutron applications are discovered automatically and rendered as desktop shortcuts.
- Neutron apps have a small electron/Neutron badge so they remain visually distinct from Plasmon-native desktop programs and files.
- Desktop icons are movable and positions are persisted in browser local storage.
- Dragging empty desktop space draws a marquee selection rectangle and selects intersecting icons.
- Local desktop files/folders support copy, cut, paste, rename, delete, and download where meaningful.
- Taskbar shows only pinned entries, open Plasmon-native windows, and Neutron apps with a live tile endpoint.
- Start uses an electron/orbital glyph rather than a lettermark.
- Start and Search are separate polished flyouts.
- Clicking the taskbar clock opens a current-month calendar flyout.

## Native desktop programs

The GUI experiment includes lightweight Plasmon-native programs so the desktop can be exercised before Kernel floating windows exist:

- Files / Explorer-style shell
- Plasmon Control
- Markdown editor with split preview
- Media Player with video library thumbnails and local video picker
- Terminal with useful shell-like commands
- Calculator
- About
- experimental Doom web frame

The local experimental filesystem is backed by browser local storage. It is not a replacement for Neutron Files/VFS. The important product experiment is the UX: Atoms behave like file-like user objects that can be named, moved, opened, and eventually shared.

## Atom shell behavior

`Budget 2026.nsheet` is included as a logical Atom example. It behaves like a file in the shell. Double-click attempts to open the installed Spreadsheet Element. Right-click exposes `Share Atom…`; the sharing backend remains intentionally unimplemented in this experiment.

## Real Neutron applications

The GUI never embeds a real Neutron app iframe inside the Plasmon iframe. Doing so would break the Kernel's immediate-parent/origin/private-MessagePort authentication model.

Launching a discovered app still calls `workspace.open_tile`, so the Kernel creates/focuses the real authenticated sibling tile.

`endpoints.list` is used to detect which Neutron app tile endpoints are live, allowing the inner taskbar to distinguish installed apps from running/open apps.

## App icons

The GUI has a resilient icon loader because first-party Neutron packages currently mix `static/icon.svg` and `static/icon.png`, and persistent-resident apps can use the unprefixed app origin. Plasmon safely probes package-local SVG/PNG/WebP/JPEG candidates on both supported app origin forms before falling back to initials.

The longer-term clean solution is for Kernel discovery to expose a safe resolved icon resource rather than requiring a launcher to infer package asset paths.

## Kernel trays

The GUI mirrors the set of tray-capable apps exposed by `apps.describe` and displays them in its own system-tray flyout.

This is not yet a full tray portal. The actual interactive tray surface is a Kernel-created authenticated iframe and its dynamic badge is owned by the Kernel tray service. Vanilla Neutron currently exposes neither the tray iframe nor badge state through a read API. A future generic Kernel `tray.list`/`tray.open` or portal capability would let Plasmon render the true tray state without weakening frame authentication.

## `.neutron` package download

A Neutron app's desktop context menu includes `Download .neutron` because that is the right desktop affordance. Current Kernel APIs do not expose the original installed package archive, so the GUI reports that limitation instead of fabricating a download. A future Kernel package-export tool would make this action functional.

## Doom and remote media

The Doom window currently embeds the public `DaniHRE/jsdoom` browser build. The media library includes remote standards/demo videos plus a local file picker. These may be blocked by future Neutron content-security policy or remote framing policy; if so, the durable solution is to package the relevant browser/WASM assets into Plasmon rather than relaxing Neutron security.

## Local validation

```bash
git fetch origin
git switch version-0.1.0-gui2
git pull --ff-only origin version-0.1.0-gui2

npm --workspace neutron-design-system run build
npm --workspace neutron-plasmon test
```

If that passes and the PocketIC server is already running:

```bash
npm run provision -- plasmon.ndeploy.json reinstall
npm run provision -- plasmon.ndeploy.json status
```

## Future Kernel direction

The intended end state is not Plasmon permanently running a second window manager inside a Neutron tile. This GUI is a UX prototype for a future generic Kernel floating-workspace mode where:

- Plasmon supplies the desktop/home/file/Atom shell;
- Kernel owns authenticated application frames, focus, permissions, tray portals, and lifecycle;
- real Neutron app tiles receive floating `x/y/width/height/z` geometry rather than being nested inside Plasmon.
