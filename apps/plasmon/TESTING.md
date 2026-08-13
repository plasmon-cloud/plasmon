# Plasmon Testing Protocol

This is the canonical development-time testing protocol for work under `apps/plasmon/**`.

The goal is fast, trustworthy feedback. Ordinary Plasmon work must not require the Neutron Kernel, Motoko packaging, Nix, or Playwright merely to prove a model/service/controller change. Browser and packaged acceptance still matter, but they are separate lanes and should be used only when the behavior crosses those boundaries.

## The default command

From the repository root:

```sh
npm --workspace neutron-plasmon test
```

This is the **fast Plasmon lane**. It runs Bun tests only and intentionally does **not** build or package Plasmon.

Do not use repository-root `npm test` as the normal Plasmon development command. Root `npm test` exercises many unrelated Neutron workspaces and is not an appropriate edit/test loop for Plasmon agents.

## Test lanes

### 1. Focused subsystem tests — run continuously

While editing, run the smallest production test surface that proves the unit of work.

Examples from `apps/plasmon/`:

```sh
bun test src/os/fs
bun test src/os/file-manager
bun test src/os/shell
bun test src/os/process
bun test src/os/windowing
bun test src/native-apps
```

A specific test file may be run directly:

```sh
bun test ./src/os/file-manager/model.test.ts
```

Bun positional arguments are path filters. Prefer focused filters while iterating, then run the full fast lane before handoff.

### 2. Plasmon fast lane — required before handoff

From the repository root:

```sh
npm --workspace neutron-plasmon test
```

Equivalent explicit command:

```sh
npm --workspace neutron-plasmon run test:fast
```

The fast lane includes colocated `src/**` tests plus package-independent Plasmon contract/integration regression tests. It excludes `test/package.test.ts` because that test reads generated build output.

### 3. Package lane — when package/build output matters

Run this when the unit of work changes build output, manifest/package behavior, generated method schema, runtime assets, packaging, or when the task explicitly requires packaged evidence:

```sh
npm --workspace neutron-plasmon run test:package
```

This performs the normal Plasmon package pipeline and then runs the package-specific test.

To run both the fast lane and package lane:

```sh
npm --workspace neutron-plasmon run test:all
```

Do not run package work after every small UI/model edit merely because the old `test` command used to package first.

### 4. Browser / Playwright lane — only for real browser/package boundaries

Playwright is not the primary Plasmon development test harness. Use browser tests when the acceptance claim depends on browser or installed-package behavior, including:

- packaged HTTP asset serving;
- real Neutron installation/launch integration;
- pointer/focus propagation and hit testing;
- browser fullscreen/download behavior;
- browser worker/runtime loading such as Monaco;
- visible cross-window behavior that cannot be proven headlessly.

Do not encode ordinary filesystem, selection, command, launch-policy, navigation, process, or window-state semantics only in Playwright when those semantics can live in production models/services/controllers and be tested with Bun.

#### Packaged golden path

The reusable packaged browser lane uses the repository's existing Playwright and `neutron-provision` infrastructure rather than a Plasmon-specific runner:

```sh
# Terminal 1, from the repository root
npm run provision -- plasmon-local.ndeploy.json serve

# Terminal 2
npm run test:e2e:plasmon:fresh
```

`plasmon-local.ndeploy.json` is the explicit local/demo deployment fixture. It installs the packaged Kernel plus Plasmon and the standalone Review Element as sibling Neutron packages. Neutron remains authoritative for both application installations; Plasmon discovers installed siblings through its normal bridge and projects them under `/Apps/*.neutron`.

`test/e2e/plasmon-golden-path.spec.ts` protects the core packaged Plasmon boundary. `test/e2e/plasmon-review-demo.spec.ts` is the narrow sibling-app demo proof: it verifies Review is independently installed, projected under `/Apps`, found/opened through canonical Plasmon Search/resource activation, and still executes its existing standalone Review provider after launch.

Use `npm run test:e2e:plasmon` to rerun the browser specs against an already deployed matching session. CI runs the same boundaries through **Plasmon Packaged Browser CI**.

Do not grow this lane into general Desktop/FileManager/Start/Search scripting or screenshot regression. Deterministic resource, process, window, and command semantics belong in Bun/headless coverage, including `test/headlessEnvironment.ts` for cross-surface workflows. Sibling-app browser journeys should remain limited to the real install/discovery/projection/open boundary they exist to protect.

### 5. Manual packaged review — visual/interaction acceptance

Human review remains authoritative for visual quality and interaction details not yet captured by stable automation. A green fast suite does not prove that spacing, icon scale, filename wrapping, animation, game feel, or other visual UX is acceptable.

## How new UI behavior should be designed for testing

Prefer production logic that can run without React or a browser:

```text
browser event
  -> thin React adapter
  -> production command/model/controller
  -> FsService / dispatcher / associations / process / window authorities
```

Tests should call the **same production command/model/controller** that the UI calls. Do not build a second fake implementation that merely mimics the UI.

Examples of good headless seams include:

- resource open, rename, copy, move, Trash, restore, shortcut and Properties commands;
- FileManager selection, marquee, keyboard, navigation and drag/drop models;
- Start/Search inventory and filtering models;
- taskbar/process/window derivation;
- cross-surface tests proving Desktop, FileManager, Start and Search resolve the same resource semantics.

Use fake/in-memory implementations only at true external boundaries such as filesystem persistence or Neutron RPC. The behavior under test must remain the real production behavior.

### Shared cross-surface harness

For workflows spanning multiple Plasmon authorities, use `test/headlessEnvironment.ts` and `createHeadlessPlasmonEnvironment()` rather than rebuilding composition in each test. The harness injects only approved external boundaries into the production `createPlasmonServices()` composition: in-memory filesystem persistence, the existing mock Neutron bridge, and a deterministic `NativeWindowManager` configuration.

The harness intentionally exposes the production service graph and small state-inspection helpers. It must not acquire feature-specific command semantics. If Desktop, FileManager, Start, Search, or another surface needs deterministic behavior that is not callable below React, move that behavior into the owning production model/controller/command first, then exercise it through the shared environment.

## CI: use it when the agent cannot run Bun locally

`.github/workflows/plasmon-ci.yml` runs **Plasmon Fast CI** on relevant pushes and pull requests across branches. It installs Node 24, Bun 1.3.14, repository dependencies, and runs:

```sh
npm --workspace neutron-plasmon test
```

It intentionally does not install Nix, package the Kernel, run Motoko tests, run Playwright, or package Plasmon.

`.github/workflows/plasmon-browser-ci.yml` is the separate package/browser gate. It packages Kernel, Plasmon, and the standalone Review sibling required by the explicit demo fixture, provisions `plasmon-local.ndeploy.json`, and runs the focused packaged Plasmon and Review-discovery browser journeys. Keep this separate from the fast lane so ordinary Plasmon edits retain a seconds-scale deterministic feedback path.

If an agent environment does not provide Bun, the agent must push the branch and use Plasmon Fast CI as the required feedback loop. `Tests not run` is not a complete handoff when CI is available.

Kernel CI is a separate concern. Plasmon-only changes do not need Kernel CI merely to validate Plasmon behavior.

## Required agent workflow

For every implementation unit:

1. Identify the authority/model/service/controller that owns the behavior.
2. Run the smallest existing focused tests before changing it when practical.
3. Add or update deterministic Bun coverage for changed semantics.
4. Iterate with focused tests.
5. Run `npm --workspace neutron-plasmon test` before handoff.
6. If local Bun is unavailable, push and require a green Plasmon Fast CI run instead.
7. Run `test:package` only when the change crosses package/build-output boundaries or the task requires it.
8. Run browser/packaged/manual acceptance when the behavior cannot be proven headlessly.

## Required handoff evidence

Every agent handoff must state:

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
  exact reason and the remaining unverified boundary
```

Do not report only `tests not run`. If a command fails because of an environment/tooling problem, preserve the exact failure and use Plasmon Fast CI when possible.

## Failure interpretation

- A focused test failure means the owned unit is not ready.
- A fast-lane failure means the Plasmon handoff is not ready unless the failing assertion is proven stale and corrected deliberately.
- A package failure does not justify weakening package expectations.
- A browser/manual failure is still a product failure even when unit tests are green.
- A Kernel/Motoko failure unrelated to the changed Plasmon surface is not evidence that the Plasmon unit itself failed; keep those lanes separate and escalate the actual dependency if Plasmon requires it.

The intended feedback loop is: **focused Bun tests in seconds, full Plasmon fast suite before handoff, package/browser evidence only at the boundaries that actually require it.**
