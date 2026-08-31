# Plasmon frontend source


`apps/plasmon/src/` contains the browser frontend and the active Plasmon OS implementation.

## Active path

`index.tsx` is the packaged frontend entrypoint and renders `os/PlasmonOS.tsx`. Service construction lives under `os/integration/`.

```text
index.tsx
  -> os/PlasmonOS.tsx
  -> os/integration/services.ts
  -> Shell + Desktop + native process/window host
```

Always verify reachability from this path before treating old source as active product behavior.

## Directory map

- `os/` — canonical desktop OS services and composition.
- `native-apps/` — Plasmon-native apps and association-backed runtime hosts.
- `games/` — game/demo content integration; content is not a replacement application architecture.
- top-level styles/helpers — shared or compatibility presentation used only where imported by the active path.

Legacy GUI and platform-compatibility code is retired from the active source tree. Git history remains the recovery source; new work must not recreate either as an alternate OS/runtime authority.

## Convergence direction

New product behavior should normally land in `os/**` or `native-apps/**`. When historical code contains behavior worth keeping, migrate that behavior into the owning canonical subsystem and add verification before removing the old path.

The desired refactor direction is fewer sources of truth:

- one filesystem authority;
- one generic resource-opening path;
- one native process/window model;
- one Neutron adapter boundary;
- one shared visual vocabulary;
- reusable headless models/services beneath React where product semantics can be tested deterministically.

Do not create a new parallel GUI, process model, filesystem, preference store, or launcher stack as a shortcut around integration work.

See `AGENTS.md` here and the nearest nested `AGENTS.md` before editing.
