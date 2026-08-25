# Plasmon test lanes

<!-- plasmon-docs-review:v1 sha256=7515da3a9ffd464b06108ce58a9a881f89c2d74505104e308dff617e6f91dfcd base=515a0b39a513dcaf87c14f6ca72aed8e11131d81 -->

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

The fast lane also enforces the repository-owned documentation contract. Structural documentation boundaries, the generated boundary map, and review fingerprints must remain current. When owned implementation changes, both that implementation change and a substantive owning README/local-AGENTS maintenance edit must be committed, with the documentation commit at or after the latest owned implementation commit, before `docs:review` can refresh the boundary fingerprint. Uncommitted edits and marker-only commits are rejected.

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

`taskbarLifecycle.test.ts` is the composed taskbar lifecycle regression. It exercises canonical Shell projection/actions over the real Process and Windowing services through pinned-only, launch, active/running, minimize/refocus, close, and external-window teardown reconciliation.

`reviewInstalledIntegration.test.ts` is the representative sibling-application proof: it verifies Review projection identity/uniqueness and canonical filesystem-open-to-Neutron-bridge activation without inventing a Plasmon-native Review process or window.

## Shared RTL adapter

Use `renderPlasmon()` from `renderPlasmon.tsx` when a claim depends on the React adapter or semantic DOM interaction but not on browser-owned behavior. It wraps the same `createHeadlessPlasmonEnvironment()` production service graph and renders the real `PlasmonOS` root. `userEvent` is preconfigured for the Happy DOM document.

Run only this layer with:

```sh
npm --workspace neutron-plasmon run test:ui
```

The preload in `setupHappyDom.ts` installs browser globals for the test process only. It does not implement filesystem, association, opening, process, window, or application semantics. Keep RTL assertions semantic (`role`, accessible name, user action) and avoid a Page Object Model.

Use RTL for things such as adapter wiring, form/button/keyboard semantics, focus state that Happy DOM models reliably, and React integration. Keep policy and cross-system state transitions in production/headless tests. Keep actual layout, iframe, worker, packaged-asset, and browser runtime claims in Playwright.

## Deployment command families

The canonical deployment details live in [`../TESTING.md`](../TESTING.md); do not duplicate a hand-maintained package inventory here.

The repository-owned coordinator is `../../test/e2e/plasmon-deployment-environment.ts`. It requires an explicit `local` or `demo` scope, reads that scope's manifest, resolves every declared inline archive to its owning workspace, runs each required production package command once, verifies the archives, and delegates provision lifecycle operations to the existing Neutron provisioning command.

`plasmon-local.ndeploy.json` is the bounded local/CI acceptance manifest used by the required Plasmon packaged browser lanes. Use the `plasmon:local:*` command family for that environment:

```sh
npm run plasmon:local:prepare
npm run plasmon:local:serve
npm run plasmon:local:status
npm run plasmon:local:reinstall
```

`plasmon.ndeploy.json` is the fuller demo manifest. Use `plasmon:demo:*` only when that larger demo deployment is intentionally required. The two command families are not interchangeable, and neither should grow a second hard-coded artifact list in this README, shell scripts, or CI.

For a deterministic clean packaged acceptance setup, use the current `test:e2e:plasmon:fresh` workflow described in `TESTING.md`; it prepares and provisions the bounded local manifest before the packaged browser suite. `npm run test:e2e:plasmon` reruns browser specs against an already matching installation.

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

The harness must not add a second PocketIC implementation, fabricated packages, or test-only product behavior.

## Package lane

Use:

```sh
npm --workspace neutron-plasmon run test:package
```

when generated build/package output is part of the acceptance claim. Build-output presence is not installed-runtime proof.

Native-app package structural coverage is enforced during the real esbuild pipeline through `src/native-apps/packaging.ts`. Optional js-dos and EmulatorJS source/runtime tests remain separate evidence; current shipped package profiles omit those runtime payloads and handlers, so their retained direct-runtime coverage must not be reported as shipped-package acceptance.

## Browser / Playwright lane

Use real browser/Neutron automation only when the claim depends on browser or installed-package behavior, such as packaged HTTP serving, real independently installed sibling applications, focus/pointer/hit-testing, workers, media, downloads, fullscreen, iframe/runtime initialization, or other browser-owned boundaries.

Keep Playwright intentionally small and semantic. The packaged Plasmon specs live in the repository-wide Playwright tree at `test/e2e/` because they reuse the root Playwright configuration and canonical Neutron provisioning/runtime helpers.

The Review browser proof is the representative independently-installed sibling-application boundary. Whether Review is present in a particular acceptance deployment comes from that deployment's current manifest and `TESTING.md`, not from a duplicated package list here. Deterministic projection uniqueness/metadata/open-dispatch semantics belong in the lower headless test instead of being broadly duplicated in Playwright.

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

Browser restart must not be simulated by creating a fresh ephemeral automation profile. A provisioning reinstall such as `plasmon:local:reinstall` or `plasmon:demo:reinstall` is an environment reset, not a browser restart; the persistence test establishes the required installed baseline before the browser lifecycle begins and does not reinstall between browser launches.

The automated repository lane uses Chromium. Firefox/LibreWolf manual persistence evidence must record whether the tested browser profile retains website data between sessions; a browser configuration that does not retain that data is a different lifecycle condition and must not be silently classified as ordinary supported restart behavior.

If this browser gate exposes a production persistence defect, preserve the browser evidence and route the smallest canonical product Issue to the owning lane. Do not repair filesystem or Neutron product behavior inside a testing-only branch.

## CI and handoff

`Plasmon Fast CI` executes the same fast command used locally. Agents without Bun must push their branch, use that workflow as the feedback loop, and report the exact result.

`Plasmon Packaged Browser CI`, `Plasmon Packaged Smoke CI`, and `Plasmon Browser Persistence CI` consume the manifest-driven bounded `plasmon:local:*` preparation/provision path. They are separate acceptance lanes; a green fast suite does not supersede a failure in package/install/browser acceptance.

Escaped repeatable failures should gain the lowest-level reliable automated coverage possible.
