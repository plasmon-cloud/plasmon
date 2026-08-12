# Plasmon test lanes

The canonical testing protocol is [`../TESTING.md`](../TESTING.md). This directory contains Plasmon-level contract, integration, packaging, and regression tests that span multiple source subsystems. Focused implementation tests should normally remain colocated with the production code they exercise.

The architectural testing rule is: keep deterministic application/OS semantics in production models, services, controllers, and commands that Bun can exercise directly; reserve package/browser/manual testing for boundaries that genuinely require them.

## Fast development lane

From the repository root:

```sh
npm --workspace neutron-plasmon test
```

This is the required pre-handoff Plasmon fast suite. It is package-independent and intentionally avoids Kernel/Motoko/package/browser work.

Do not use repository-root `npm test` as the ordinary Plasmon edit/test loop; it exercises unrelated Neutron workspaces.

## Focused tests

Run the smallest relevant Bun filter while iterating, for example from `apps/plasmon/`:

```sh
bun test src/os/fs
bun test src/os/file-manager
bun test src/os/shell
bun test src/os/process
bun test src/os/windowing
bun test src/native-apps
```

Prefer executable behavior over source-string assertions. If source inspection is unavoidable, assert the smallest durable relationship rather than local naming or incidental implementation shape.

## Reusable headless environment

`headlessEnvironment.ts` provides the shared fast composition for cross-surface workflows. It calls `createPlasmonServices()` with deterministic external boundaries rather than reproducing OS behavior in tests:

- `MemoryFsRepository` backs the real `PersistentFsService`;
- `MockNeutronBridge` stands in for Neutron RPC;
- `NativeWindowManager` runs with deterministic IDs and a fixed headless viewport;
- filesystem bootstrap/policy, associations, opening, native-app registration, process lifecycle, and window semantics remain the production implementations.

Use `createHeadlessPlasmonEnvironment()` when a workflow spans several Plasmon authorities and does not require React or browser behavior. Prefer its exposed production `services` plus small state-inspection helpers over feature-specific fake models. Pass an existing `MemoryFsRepository` through the `repository` option when a workflow must reconstruct the production composition over the same persistence boundary. If a workflow needs a new semantic operation, add that operation to the owning production model/controller/command rather than implementing it in this harness.

## Package lane

Use:

```sh
npm --workspace neutron-plasmon run test:package
```

when generated build/package output is part of the acceptance claim. Build-output presence is not installed-runtime proof.

Native-app package structural coverage is enforced during the real esbuild pipeline through `src/native-apps/packaging.ts`. It checks build-metafile inputs across all outputs for the accepted first-party launchable native app loaders instead of freezing generated chunk filenames. This proves required application code is present in the package build graph; it does not prove app behavior or browser interaction. Runtime-only hosts such as js-dos remain under their dedicated runtime package/asset assertions rather than this launchable-app inventory.

## Browser / Playwright lane

Use real browser/Neutron automation only when the claim depends on browser or installed-package behavior, such as packaged HTTP serving, focus/pointer/hit-testing, workers, media, downloads, fullscreen, iframe/runtime initialization, or other browser-owned boundaries.

Keep Playwright intentionally small and semantic. Stable tests should target user intent and durable roles/identifiers rather than CSS geometry or transient visual structure.

The packaged golden-path spec lives in the repository-wide Playwright tree at `test/e2e/plasmon-golden-path.spec.ts`, because it intentionally reuses the existing root Playwright configuration and Neutron provisioning/runtime helpers. Its dedicated deployment input is `plasmon-local.ndeploy.json`.

From the repository root, run a local session with:

```sh
# Terminal 1
npm run provision -- plasmon-local.ndeploy.json serve

# Terminal 2
npm run test:e2e:plasmon:fresh
```

Use `npm run test:e2e:plasmon` to rerun only the browser spec against the already deployed matching session. **Plasmon Packaged Browser CI** runs this same narrow installed-package boundary in CI.

Do not add broad Desktop/FileManager/Start/Search scripts here merely because Playwright can click them. Their deterministic behavior belongs in production models/controllers/services and Bun/headless tests. Screenshot regression is also outside this lane unless visual fidelity itself becomes a separately accepted contract.

## Cross-surface workflow tests

A major goal of the Plasmon harness is to test the same production authority through every relevant surface. When Desktop, FileManager, Start, Search, or native applications expose the same operation, prefer shared headless workflow tests over duplicating browser scripts.

Tests should call the same production models/controllers/commands that React adapters call; do not create a second fake implementation that merely imitates the UI.

## CI and handoff

`Plasmon Fast CI` executes the same fast command used locally. Agents without Bun must push their branch, use that workflow as the feedback loop, and report the exact CI result.

`Plasmon Packaged Browser CI` is a separate acceptance lane: it packages the Kernel and Plasmon, provisions the minimal Plasmon PocketIC config, runs the Plasmon package test, and executes only the golden-path browser spec. A green fast suite does not supersede a failure in this package/browser lane.

Escaped repeatable failures should gain the lowest-level reliable automated coverage possible.
