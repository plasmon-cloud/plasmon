# Plasmon test lanes

The canonical testing protocol is [`../TESTING.md`](../TESTING.md). This directory contains Plasmon-level contract, integration, React-adapter, packaging, and regression tests that span multiple source subsystems. Focused implementation tests should normally remain colocated with the production code they exercise.

The testing hierarchy is:

1. focused Bun tests for production models/services/controllers;
2. `createHeadlessPlasmonEnvironment()` for deterministic cross-system production composition;
3. RTL + `user-event` + Happy DOM for React/browser adapters that do not require a real browser;
4. package tests for generated/package output;
5. Playwright only for genuine installed-package/browser/runtime boundaries;
6. manual acceptance for visual/interaction claims that are not stable automated contracts.

Do not move deterministic OS semantics upward merely because a higher layer can exercise them.

## Fast development lane

From the repository root:

```sh
npm --workspace neutron-plasmon test
```

This is the required pre-handoff Plasmon fast suite. It is package-independent and intentionally avoids Kernel/Motoko/package/browser work. It includes both deterministic production-composition tests and the bounded RTL adapter tests.

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

`headlessEnvironment.ts` provides the authoritative fast composition for cross-surface workflows. It calls `createPlasmonServices()` with deterministic external boundaries rather than reproducing OS behavior in tests:

- `MemoryFsRepository` backs the real `PersistentFsService`;
- `MockNeutronBridge` stands in for Neutron RPC;
- `NativeWindowManager` runs with deterministic IDs and a fixed headless viewport;
- filesystem bootstrap/policy, associations, opening, native-app registration, process lifecycle, and window semantics remain production implementations.

Use `createHeadlessPlasmonEnvironment()` when a workflow spans several Plasmon authorities and does not require React behavior. Pass an existing `MemoryFsRepository` through the `repository` option when a workflow must reconstruct production composition over the same persistence boundary. If a workflow needs a new semantic operation, add it to the owning production model/controller/command rather than implementing it in this harness.

`reviewInstalledIntegration.test.ts` is the representative sibling-application proof: it verifies Review projection identity/uniqueness and canonical filesystem-open-to-Neutron-bridge activation without inventing a Plasmon-native Review process or window.

## Shared RTL adapter

Use `renderPlasmon()` from `renderPlasmon.tsx` when a claim depends on the React adapter or semantic DOM interaction but not on browser-owned behavior. It wraps the same `createHeadlessPlasmonEnvironment()` production service graph and renders the real `PlasmonOS` root. `userEvent` is preconfigured for the Happy DOM document.

Run only this layer with:

```sh
npm --workspace neutron-plasmon run test:ui
```

The preload in `setupHappyDom.ts` installs browser globals for the test process only. It does not implement filesystem, association, opening, process, window, or application semantics. Keep RTL assertions semantic (`role`, accessible name, user action) and avoid a Page Object Model.

Use RTL for things such as adapter wiring, form/button/keyboard semantics, focus state that Happy DOM models reliably, and React integration. Keep policy and cross-system state transitions in production/headless tests. Keep actual layout, iframe, worker, packaged-asset, and browser runtime claims in Playwright.

## Installed demo environment

`plasmon-local.ndeploy.json` is the source of truth for the real local/CI Plasmon acceptance environment. Do not maintain a second package list in shell scripts or CI.

The repository-owned coordinator is `test/e2e/plasmon-demo-environment.ts`. It reads the manifest, resolves each inline archive to its owning workspace, runs only that workspace's production `package` command, verifies every required archive exists, then delegates lifecycle operations to the existing `neutron-provision` command.

Current manifest-derived artifacts are Kernel, Plasmon, and the independently installed Review application. When the manifest changes, preparation follows it automatically.

From the repository root:

```sh
npm run plasmon:demo:prepare
npm run plasmon:demo:serve
npm run plasmon:demo:status
npm run plasmon:demo:reinstall
```

For a deterministic clean local acceptance setup, start `plasmon:demo:serve` in one terminal and run:

```sh
npm run test:e2e:plasmon:fresh
```

`test:e2e:plasmon:fresh` packages the manifest-derived artifacts, cleanly reinstalls through `neutron-provision`, then runs the packaged Plasmon browser suite. `npm run test:e2e:plasmon` reruns only the browser specs against an already matching deployment.

This preserves the acceptance boundary:

```text
production package command
  -> .neutron archive
  -> neutron-provision install/reinstall
  -> Neutron
  -> Plasmon
  -> /Apps projection
  -> canonical filesystem/open bridge
```

The harness must not add a second PocketIC implementation or test-only product behavior.

## Package lane

Use:

```sh
npm --workspace neutron-plasmon run test:package
```

when generated build/package output is part of the acceptance claim. Build-output presence is not installed-runtime proof.

Native-app package structural coverage is enforced during the real esbuild pipeline through `src/native-apps/packaging.ts`. Runtime-only hosts such as js-dos remain under their dedicated runtime package/asset assertions.

## Browser / Playwright lane

Use real browser/Neutron automation only when the claim depends on browser or installed-package behavior, such as packaged HTTP serving, real independently installed sibling applications, focus/pointer/hit-testing, workers, media, downloads, fullscreen, iframe/runtime initialization, or other browser-owned boundaries.

Keep Playwright intentionally small and semantic. The packaged Plasmon specs live in the repository-wide Playwright tree at `test/e2e/` because they reuse the root Playwright configuration and canonical Neutron provisioning/runtime helpers.

The Review browser proof remains responsible for the actual independently installed Review package, `/Apps/Review.neutron` visibility through real Plasmon, activation into the installed Review iframe/application, and representative real interaction. Deterministic projection uniqueness/metadata/open-dispatch semantics belong in the lower headless test instead of being broadly duplicated in Playwright.

Do not add broad Desktop/FileManager/Start/Search scripts merely because Playwright can click them. Screenshot regression is outside this lane unless visual fidelity itself becomes a separately accepted contract.

### Real-browser persistence boundary

`test/e2e/plasmon-persistence.spec.ts` is the browser-owned filesystem durability gate for #186. It deliberately stays above the headless repository tests because the contract depends on the lifetime of the real packaged resident background and browser profile.

The supported automated journey is:

```text
real packaged Plasmon
  -> import a Desktop resource through FileManager
  -> preserve its NodeId across Plasmon tile close/reopen
  -> preserve it across top-level page reload
  -> close the Chromium process
  -> relaunch Chromium with the same retained user-data directory
  -> preserve the resident background origin, NodeId, and written bytes
```

Browser restart must not be simulated by creating a fresh ephemeral automation profile. Likewise, `plasmon:demo:reinstall` is an environment/provisioning reset, not a browser restart; the persistence test establishes any fresh installed baseline before the browser lifecycle begins and does not reinstall between browser launches.

The automated repository lane uses Chromium. Firefox/LibreWolf manual persistence evidence must record whether the tested browser profile retains website data between sessions; a browser configuration that does not retain that data is a different lifecycle condition and must not be silently classified as ordinary supported restart behavior.

If this browser gate exposes a production persistence defect, preserve the browser evidence and route the smallest canonical product Issue to the owning lane. Do not repair filesystem or Neutron product behavior inside the Testing Lead branch.

## CI and handoff

`Plasmon Fast CI` executes the same fast command used locally. Agents without Bun must push their branch, use that workflow as the feedback loop, and report the exact result.

`Plasmon Packaged Browser CI` consumes the same manifest-driven preparation/provision path used locally. It is a separate acceptance lane; a green fast suite does not supersede a failure in package/install/browser acceptance.

`Plasmon Browser Persistence CI` owns the #186 retained-profile browser-process restart guard. It packages and provisions through the same demo environment but keeps that installation live while the persistence spec closes and relaunches Chromium.

Escaped repeatable failures should gain the lowest-level reliable automated coverage possible.
