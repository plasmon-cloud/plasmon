# Windowing dependency requirements

No shared package or build changes are required by this implementation.

- `react` — runtime dependency already present in `apps/plasmon/package.json`; used by `NativeWindow`, `WindowLayer`, and `useWindowStates`.
- `react-rnd` — **not required**. The design permits it, but this implementation uses Pointer Events plus `requestAnimationFrame` so Agent 4 does not require a shared package/lockfile edit. The mature daedalOS interaction behaviors relevant to Plasmon are adapted locally and attributed in `THIRD_PARTY.md`.

If integration later replaces the local pointer primitive with `react-rnd`, the integration agent must add the package centrally rather than changing shared manifests from this subsystem branch.
