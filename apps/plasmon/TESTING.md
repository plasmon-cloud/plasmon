# Plasmon Testing Protocol

This is the canonical development-time testing protocol for work under `apps/plasmon/**`.

The goal is fast, trustworthy feedback at the lowest layer that can prove a claim. Ordinary Plasmon work must not require the Neutron Kernel, Motoko packaging, Nix, or Playwright merely to prove deterministic application/OS semantics. Installed-package and browser acceptance remain separate required lanes when the behavior crosses those boundaries.

## Default command

From the repository root:

```sh
npm --workspace neutron-plasmon test
```

This is the **Plasmon fast lane**. It runs Bun-based deterministic and RTL tests and intentionally does not package Plasmon or the Kernel.

Do not use repository-root `npm test` as the normal Plasmon edit loop. It exercises unrelated Neutron workspaces.

## Testing hierarchy

Use the lowest layer that proves the acceptance claim:

1. focused Bun tests for production models, services, controllers, commands, and pure helpers;
2. `createHeadlessPlasmonEnvironment()` for deterministic cross-system production composition;
3. React Testing Library + `@testing-library/user-event` + Happy DOM for React/browser adapters that do not require a real browser;
4. package tests when generated/package output is part of the contract;
5. Playwright only for genuine installed-package/browser/runtime boundaries;
6. manual packaged review for visual/interaction details that are not stable automated contracts.

Do not duplicate lower deterministic semantics in Playwright merely because a browser can exercise them.

## 1. Focused subsystem tests

While editing, run the smallest production test surface that proves the unit of work. Examples from `apps/plasmon/`:

```sh
bun test src/os/fs
bun test src/os/file-manager
bun test src/os/shell
bun test src/os/process
bun test src/os/windowing
bun test src/native-apps
```

A specific file can be run directly:

```sh
bun test ./src/os/file-manager/model.test.ts
```

Prefer executable behavior over source-string assertions.

## 2. Shared deterministic production composition

For workflows spanning several Plasmon authorities, use `test/headlessEnvironment.ts` and `createHeadlessPlasmonEnvironment()` rather than rebuilding composition in each test.

The harness calls production `createPlasmonServices()` and replaces only true external/environment boundaries:

- `MemoryFsRepository` backs the real persistent filesystem service;
- `MockNeutronBridge` stands in for Neutron RPC/discovery;
- `NativeWindowManager` uses deterministic IDs and a fixed headless viewport;
- filesystem bootstrap/policy, associations, canonical opening, native-app registration, process lifecycle, and window semantics remain production implementations.

The harness intentionally exposes the production service graph plus small inspection helpers. It must not acquire feature-specific business semantics. If a deterministic operation is trapped in React, move it into the owning production model/controller/command first, then exercise it through the shared environment.

Pass an existing `MemoryFsRepository` through the `repository` option when a test must reconstruct production composition over the same persistence boundary.

`test/reviewInstalledIntegration.test.ts` is the representative independently-installed-app proof. It verifies that duplicate Kernel discovery for Review still reconciles to one `/Apps/Review.neutron` resource with canonical metadata and that opening the projected resource reaches exactly one `NeutronBridge.openElement("review")` call through the production filesystem/open dispatcher. It deliberately asserts that no fake Plasmon-native Review process/window is created because authenticated Neutron applications remain Kernel-owned sibling tiles.

## 3. Shared RTL adapter layer

Use `test/renderPlasmon.tsx` when a claim depends on the React adapter or semantic DOM interaction but not on browser-owned layout/runtime behavior.

`renderPlasmon()`:

- creates the same `createHeadlessPlasmonEnvironment()` production composition;
- waits for production bootstrap readiness;
- renders the real `PlasmonOS` root with those real `PlasmonServices`;
- returns normal RTL queries plus the headless environment and a configured `userEvent` instance;
- owns unmount/environment disposal through its `dispose()` helper.

Happy DOM globals are installed by `test/setupHappyDom.ts` only for the RTL test process. They are an adapter boundary, not an OS implementation.

Run this layer alone with:

```sh
npm --workspace neutron-plasmon run test:ui
```

Prefer semantic queries and actions (`role`, accessible name, keyboard/user intent). Do not build a Page Object Model. Use this layer for React wiring, form/button/keyboard semantics, and focus behavior Happy DOM models reliably. Keep filesystem/open/process/window policy in production/headless tests. Keep iframe, worker, packaged-asset, real layout/hit-testing, fullscreen, download, and browser-runtime behavior in Playwright.

The full fast lane remains:

```sh
npm --workspace neutron-plasmon run test:fast
```

and includes both deterministic production-composition tests and the bounded RTL layer.

## 4. Package lane

Run package tests when build output, manifest/package behavior, generated method schema, runtime assets, or packaged structure is part of the acceptance claim:

```sh
npm --workspace neutron-plasmon run test:package
```

To run fast plus package:

```sh
npm --workspace neutron-plasmon run test:all
```

Do not run package work after every small UI/model edit merely because the behavior eventually ships in a package.

## 5. Real installed demo environment

`plasmon-local.ndeploy.json` is the explicit source of truth for the local/CI Plasmon acceptance deployment. Do not maintain a second hand-written package list in shell commands or CI.

The repository-owned coordinator is:

```text
test/e2e/plasmon-demo-environment.ts
```

It reads the manifest, resolves each inline `.neutron` archive to its owning workspace, runs only that workspace's production `package` command, verifies every required archive exists, and delegates PocketIC/Neutron lifecycle operations to the existing `neutron-provision` command.

The current manifest resolves to exactly:

- Kernel;
- Plasmon;
- independently installed Review.

When the acceptance manifest changes, preparation follows that manifest instead of requiring a second package-list edit.

Available root commands:

```sh
npm run plasmon:demo:prepare
npm run plasmon:demo:serve
npm run plasmon:demo:status
npm run plasmon:demo:reinstall
```

For a clean local acceptance environment, start the server in one terminal:

```sh
npm run plasmon:demo:serve
```

Then in another terminal run:

```sh
npm run test:e2e:plasmon:fresh
```

The fresh command packages the manifest-derived artifacts, performs a clean reinstall through `neutron-provision`, and runs the packaged Plasmon browser suite. Use `npm run test:e2e:plasmon` to rerun only browser specs against an already matching installation.

This testing harness must preserve the real boundary:

```text
production package command
  -> .neutron archive
  -> neutron-provision install/reinstall
  -> Neutron
  -> Plasmon
  -> /Apps projection
  -> canonical filesystem/open bridge
```

Do not add a second PocketIC implementation, test-only product behavior, fabricated packages, or direct Review launch shortcuts.

## 6. Browser / Playwright lane

Playwright is not the primary Plasmon development harness. Use it when the acceptance claim genuinely depends on installed/browser behavior, including:

- packaged HTTP asset serving;
- real Neutron install/launch integration;
- independently installed sibling application loading;
- real iframe/runtime initialization;
- browser workers such as Monaco/runtime hosts;
- pointer/focus propagation or hit testing that requires a browser;
- downloads, media, or fullscreen.

The packaged Plasmon specs live under repository-root `test/e2e/` so they reuse the existing Playwright configuration and canonical Neutron provisioning helpers.

`test/e2e/plasmon-review-demo.spec.ts` remains the installed Review boundary proof. It verifies Review exists as an independently installed package, Plasmon exposes `/Apps/Review.neutron`, canonical activation reaches the installed Review iframe/application, representative Review interaction works, and browser errors are surfaced. Projection uniqueness/metadata and canonical open-dispatch policy are already proved below Playwright and should not be broadly duplicated there.

Do not grow Playwright into general Desktop/FileManager/Start/Search scripts or screenshot regression unless the acceptance claim itself requires a real browser.

## 7. Manual packaged review

Human review remains authoritative for visual quality and interaction details not represented by stable automation: spacing, icon scale, filename wrapping, animation, game feel, and similar UX claims.

A green automated suite does not by itself prove visual quality.

## How UI behavior should be designed for testing

Prefer production logic below React:

```text
browser event
  -> thin React adapter
  -> production command/model/controller
  -> FsService / dispatcher / associations / process / window authorities
```

Tests must call the same production command/model/controller used by the UI. Use fake/in-memory implementations only at true environment boundaries such as persistence or Neutron RPC.

Good lower-level seams include resource open/rename/copy/move/Trash/restore, FileManager selection/navigation/commands, Start/Search inventory/filtering, taskbar/process/window derivation, and cross-surface resource workflows.

If the existing shared harness lacks only a reusable browser adapter or RTL composition, improve the shared testing seam. Do not teach each domain agent a new custom sequence of shell commands or local fakes.

## CI

For r2 pull requests, `.github/workflows/plasmon-ci.yml` runs **Plasmon Fast CI on every PR**, independent of changed files, using:

```sh
npm --workspace neutron-plasmon test
```

Direct-push applicability may retain its explicit branch/path filters; that does not change the complete-PR execution contract.

It installs the test dependencies but intentionally avoids Kernel packaging, Motoko/Nix, and Playwright.

`.github/workflows/plasmon-browser-ci.yml` is the separate installed-package/browser gate. It consumes the same manifest-driven `plasmon:demo:*` preparation/provision path used locally instead of maintaining its own Kernel/Plasmon/Review package list.

If an agent environment cannot run Bun locally, push the Issue branch and use Plasmon Fast CI as the feedback loop. `Tests not run` is not a complete handoff when CI is available.

Kernel and independently installed application workflows remain separate required evidence when the changed boundary requires them. Do not weaken or skip those gates to make Plasmon CI green.

## Required agent workflow

For every implementation unit:

1. identify the authority/model/service/controller that owns the behavior;
2. establish or preserve the deterministic RED at the lowest reliable layer;
3. implement the smallest GREEN change;
4. run the smallest focused test while iterating;
5. run `npm --workspace neutron-plasmon test` before handoff, locally or through CI;
6. run `test:package` only when package/build output is part of the claim;
7. run packaged/browser acceptance when the real install/browser boundary is part of the claim;
8. preserve exact failure evidence and classify genuine external dependency failures rather than weakening tests.

## Required handoff evidence

Every handoff must state:

```text
Focused tests:
  command: <exact command>
  result: PASS | FAIL | NOT RUN

Plasmon fast suite:
  command: npm --workspace neutron-plasmon test
  result: PASS | FAIL | CI PASS | CI FAIL | NOT RUN

Additional verification:
  package/browser/manual command or observation, if required

Not run / failures:
  exact reason and remaining unverified boundary
```

Failure interpretation:

- focused failure: the owned unit is not ready;
- fast-lane failure: the Plasmon handoff is not ready unless the assertion is deliberately corrected as stale;
- package failure: do not weaken package expectations;
- browser/manual failure: still a real acceptance failure even when lower tests pass;
- unrelated Kernel/Motoko failure: preserve and escalate the actual dependency rather than rewriting Plasmon behavior.

The intended feedback loop is: **focused Bun in seconds → shared production composition → bounded RTL when React matters → full fast lane → package/install/browser only for the boundaries that require them.**
