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

The prior GUI experiment and parallel platform compatibility layer have been retired from the active source tree. Git history remains the recovery source for those experiments; new work must not recreate either as an alternate OS/runtime authority.

## Retired presentation boundaries

The former parallel frontend trees `gui2/` and `platform/` are intentionally absent. Their useful behavior has either migrated into the canonical OS/native-application graph or remains available only through Git history for reference. Active source must not import or recreate those trees as compatibility shortcuts.

`issue-201-presentation-retirement.test.ts` mechanically preserves that retirement in the normal fast Bun lane. New shared presentation belongs in `os/visual/` only when multiple active consumers demonstrate common presentation meaning; semantic filesystem, process, association, windowing, and application behavior stays with its owning subsystem.

A repository-wide dead-code/export dependency is intentionally not added merely to satisfy a tooling checkbox. For the known retired frontend boundaries, the actionable evidence is stronger and deterministic: the directories are absent and active source imports are guarded. Add broader dead-code tooling only after evaluating it against the current active source graph and demonstrating a low-noise signal that finds actionable production leftovers.

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
