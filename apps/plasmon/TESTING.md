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
2. `createHeadlessPlasmonEnvironment()` for deterministic cross-system production composition, using its production `env.os` semantic API when the workflow represents legitimate OS operations;
3. React Testing Library + `@testing-library/user-event` + Happy DOM for React/browser adapters that do not require a real browser;
4. package tests when generated/package output is part of the contract;
5. Playwright only for genuine installed-package/browser/runtime boundaries;
6. manual packaged review for visual/interaction details that are not stable automated contracts.

Do not duplicate lower deterministic semantics in Playwright merely because a browser can exercise them. Do not force focused subsystem tests through `OsApi` merely because that higher-level API exists.

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

The harness exposes the production service graph for focused composition work and the production semantic `OsApi` as `env.os` for high-level deterministic workflows. `env.os` is created by `createPlasmonOsApi()` from the same production services; the test harness must not implement a second product-semantic facade over `environment.services`.

Use `env.os` when the setup or behavior is a legitimate OS operation a normal authorized automation caller could reasonably perform. The current R3 surface includes filesystem stat/existence/list/text read-write/directory creation/copy/move/Trash removal, canonical resource opening, and process/window observation. Example:

```ts
const env = createHeadlessPlasmonEnvironment();
await env.ready;

await env.os.fs.writeText("/Desktop/example.txt", "hello");
const opened = await env.os.open("/Desktop");

expect(env.os.processes.list()).toContainEqual(
  expect.objectContaining({ id: opened.processId }),
);
```

The semantic API is a production contract under `src/os/api/`; it must delegate to the existing owning authorities rather than recreate filesystem protection, associations, open dispatch, process lifecycle, window policy, or Trash behavior. Its public contracts/DTOs must remain dependency-light and must not depend on concrete service/controller classes or anything under `test/`.

Keep test superpowers outside `OsApi`. Global deterministic settlement, programmable external success/failure/defer behavior, fake call recording, clock control, transport faults, impossible-state construction, policy bypasses, and assertions belong in test-only support beside `env.os`, not on the production API. Operation-specific completion/readiness belongs in production only when it represents a real named Product lifecycle boundary rather than a replacement for sleeps.

The harness must not acquire feature-specific business semantics. If a deterministic operation is trapped in React, move it into the owning production model/controller/command first. If a high-level deterministic workflow needs a legitimate OS operation that is absent from `OsApi`, treat that as a candidate generalized production API gap instead of immediately encoding the workflow in Playwright.

Pass an existing `MemoryFsRepository` through the `repository` option when a test must reconstruct production composition over the same persistence boundary.

The legacy headless `node()`, `open()`, `processes()`, and `windows()` conveniences remain during the bounded R3 transition so existing coverage does not need a migration campaign. New high-level deterministic tests should prefer `env.os`; systematic retroactive migration belongs to the deeper testing audit rather than this quick pass.

`test/reviewInstalledIntegration.test.ts` is the representative independently-installed-app proof. It verifies that duplicate Kernel discovery for Review still reconciles to one `/Apps/Review.neutron` resource with canonical metadata and that opening the projected resource reaches exactly one `NeutronBridge.openElement("review")` call through the production filesystem/open dispatcher. It deliberately asserts that no fake Plasmon-native Review process/window is created because authenticated Neutron applications remain Kernel-owned sibling tiles.

## 3. Shared RTL adapter layer

Use `test/renderPlasmon.tsx` when a claim depends on the React adapter or semantic DOM interaction but not on browser-owned layout/runtime behavior.

`renderPlasmon()`:

- creates the same `createHeadlessPlasmonEnvironment()` production composition;
- waits for production bootstrap readiness;
- renders the real `PlasmonOS` root with those real `PlasmonServices`;
- returns normal RTL queries plus the headless environment and a configured `userEvent` instance;
- therefore exposes the same production `environment.os` for legitimate setup and post-action state inspection;
- owns unmount/environment disposal through its `dispose()` helper.

Happy DOM globals are installed by `test/setupHappyDom.ts` only for the RTL test process. They are an adapter boundary, not an OS implementation.

Run this layer alone with:

```sh
npm --workspace neutron-plasmon run test:ui
```

Prefer semantic queries and actions (`role`, accessible name, keyboard/user intent). Do not build a Page Object Model. Use this layer for React wiring, form/button/keyboard semantics, and focus behavior Happy DOM models reliably. `environment.os` may establish legitimate user-reachable state or inspect the resulting production state, but actual React behavior should still be driven through RTL/user-event. Keep filesystem/open/process/window policy in production/headless tests. Keep iframe, worker, packaged-asset, real layout/hit-testing, fullscreen, download, and browser-runtime behavior in Playwright.

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

## 5. Plasmon deployment command families

Plasmon has two manifest-specific deployment families. The command namespace identifies the deployment manifest and must not be treated as interchangeable.

The repository-owned coordinator is:

```text
test/e2e/plasmon-deployment-environment.ts
```

It requires an explicit `local` or `demo` scope, reads that scope's manifest, resolves every inline `.neutron` archive to its owning workspace, runs each required workspace's production `package` command once, verifies every declared archive exists, and delegates PocketIC/Neutron lifecycle operations to the existing `neutron-provision` command. Do not maintain a second hand-written package list in shell commands or CI.

### Bounded Plasmon local/E2E fixture

`plasmon-local.ndeploy.json` is the source of truth for the bounded local/CI Plasmon acceptance deployment. It currently declares exactly:

- Kernel;
- Plasmon;
- independently installed Review.

Use:

```sh
npm run plasmon:local:prepare
npm run plasmon:local:serve
npm run plasmon:local:status
npm run plasmon:local:reinstall
```

For a clean local acceptance environment, start the server in one terminal:

```sh
npm run plasmon:local:serve
```

Then in another terminal run:

```sh
npm run test:e2e:plasmon:fresh
```

The fresh command packages only the artifacts declared by `plasmon-local.ndeploy.json`, performs a clean reinstall through `neutron-provision`, and runs the packaged Plasmon browser suite. Use `npm run test:e2e:plasmon` to rerun only browser specs against an already matching installation.

Required Plasmon packaged CI and the ordinary broad flake boundary use this `plasmon:local:*` family. Targeted profile-specific characterization uses the truthful profile selected by the test inventory rather than forcing a demo/full acceptance against the slim/local package.

### Full Plasmon demo deployment

`plasmon.ndeploy.json` is the source of truth for the fuller Plasmon demo deployment and its larger application set. Use:

```sh
npm run plasmon:demo:prepare
npm run plasmon:demo:serve
npm run plasmon:demo:status
npm run plasmon:demo:reinstall
```

`npm run plasmon:demo:prepare` packages and verifies **every artifact declared by `plasmon.ndeploy.json`**. The other `plasmon:demo:*` lifecycle commands likewise target that same manifest. This family is not the bounded E2E fixture.

### Generic repository `local:*` commands

The existing root `local:authorize`, `local:start`, `local:deploy`, and `local:status` commands are a separate Neutron repository development surface. They operate on `local.ndeploy.json`; they are not aliases for the Plasmon-specific `plasmon:local:*` family and are intentionally unchanged.

The Plasmon testing harness must preserve the real boundary:

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

The focused command/manifest regression is:

```sh
npm run test:plasmon:deployment-commands
```

It proves the local and demo command scopes resolve different canonical manifests and that each preparation plan includes every artifact declared by its selected manifest.

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

`test/e2e/plasmon-demo-review.spec.ts` remains the installed Review boundary proof. It verifies Review exists as an independently installed package, Plasmon exposes `/Apps/Review.neutron`, canonical activation reaches the installed Review iframe/application, representative Review interaction works, and browser errors are surfaced. Projection uniqueness/metadata and canonical open-dispatch policy are already proved below Playwright and should not be broadly duplicated there.

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

For high-level deterministic workflows, the preferred semantic route is:

```text
env.os
  -> production createPlasmonOsApi()
  -> production service/controller/command authorities
```

Good lower-level seams include resource open/rename/copy/move/Trash/restore, FileManager selection/navigation/commands, Start/Search inventory/filtering, taskbar/process/window derivation, and cross-surface resource workflows. Only the subset currently represented as legitimate durable `OsApi` capabilities belongs on that public semantic contract; the rest should remain with their owning subsystem until a real automation/testing need justifies expansion.

If the existing shared harness lacks only reusable test settlement/effect/scenario support, improve test support beside `env.os`. If it lacks a legitimate user-automatable OS operation, consider expanding the production `OsApi`. Do not teach each domain agent a new custom sequence of shell commands, local fakes, or Playwright clicks for deterministic Product semantics.

## CI

For pull requests selected by the canonical Plasmon CI branch-role policy, `.github/workflows/plasmon-ci.yml` runs **Plasmon Fast CI** using:

```sh
npm --workspace neutron-plasmon test
```

Direct-push applicability may retain its explicit branch/path filters; that does not change the pull-request execution contract for branches covered by that policy.

It installs the test dependencies but intentionally avoids Kernel packaging, Motoko/Nix, and Playwright. Fast CI also executes the focused deployment command/manifest regression so the `demo` and `local` namespaces cannot silently converge again.

### Staged review, merge-queue, and post-merge CI

Expensive installed-package/browser validation is staged around review rather than paid on every intermediate PR revision. The detailed executable contract is documented in [`../../.github/workflows/PLASMON_STAGED_CI.md`](../../.github/workflows/PLASMON_STAGED_CI.md).

The phase contract is:

1. **ordinary PR head** — Fast Bun tests run as real readiness evidence; stable required packaged/browser, Kernel, and Flake Probe contexts report staged success without installing Nix, starting PocketIC, or launching Playwright;
2. **normal GitHub approval** — the full required confidence gate runs: every required non-quarantined acceptance once, one broad retry-free `all` observation, and conditional impacted Playwright characterization exactly 3× in one prepared targeted packet; any approval-stage failure blocks Merge;
3. **merge queue** — Fast Bun tests are the real test workload on the synthetic `merge_group` SHA; expensive package/PocketIC/Playwright/Kernel contexts report quickly without repeating slow work that already passed before the user pressed Merge;
4. **integrated `release/**` push** — diagnostic Flake Probe records exactly 3 broad retry-free observations plus conditional 3 targeted characterization observations; the targeted 3 use one prepared packet, while broad 3 may remain independent setups until shared-state reuse is proven safe;
5. **explicit diagnostic request** — `ci:flake-probe` remains the targeted exact-head 50-iteration diagnostic mechanism. `ci:flaky` is classification/debt metadata, not the heavy-probe trigger.

The intended mental model is: **approval-stage CI decides correctness; pressing Merge commits the change to merging; the merge queue is a fast final integration checkpoint; post-merge probing looks for flakiness without delaying the merge.**

Every required status context must continue to report for `merge_group: checks_requested`, but slow contexts must not repeat their expensive workloads there. A merge-queue failure is an integration/scheduling signal to investigate. A post-merge diagnostic failure remains visible evidence but cannot retroactively undo the completed merge.

Profile-specific Playwright characterization must use the package profile that can truthfully execute the selected acceptance. Never characterize a demo/full-profile acceptance against the slim/local package merely to reuse an environment.

If an agent environment cannot run Bun locally, push the Issue branch and use Plasmon Fast CI as the feedback loop. `Tests not run` is not a complete handoff when CI is available.

Kernel and independently installed application workflows remain separate required evidence when the changed boundary requires them. Do not weaken or skip those gates to make Plasmon CI green.

### Browser quarantine authority

Required browser CI and Flake Probe use the fixed Playwright tag `@quarantine`. The machine-readable current debt authority is [`../../test/ci/plasmon-quarantine.json`](../../test/ci/plasmon-quarantine.json); [`../../test/ci/QUARANTINED_BROWSER_TESTS.md`](../../test/ci/QUARANTINED_BROWSER_TESTS.md) explains the same current state for contributors. The inventory records which exact semantic acceptances are authorized debt; it does not configure or rename the quarantine tag.

Quarantine is exact-test scoped and must not become a suite skip, retry policy, timeout increase, or generic green-on-failure path. Restoration removes the exact `@quarantine` marker and inventory entry before collecting retry-free proof. Unknown and non-quarantined failures remain hard failures.

## Required agent workflow

For every implementation unit:

1. identify the authority/model/service/controller that owns the behavior;
2. establish or preserve the deterministic RED at the lowest reliable layer;
3. for a high-level deterministic workflow, use `env.os` when the action is a legitimate production OS capability rather than writing new browser automation;
4. implement the smallest GREEN change;
5. run the smallest focused test while iterating;
6. run `npm --workspace neutron-plasmon test` before handoff, locally or through CI;
7. run `test:package` only when package/build output is part of the claim;
8. run packaged/browser acceptance when the real install/browser boundary is part of the claim;
9. preserve exact failure evidence and classify genuine external dependency failures rather than weakening tests.

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

The intended feedback loop is: **focused Bun in seconds → shared production composition/`env.os` for high-level OS behavior → bounded RTL when React matters → full fast lane → package/install/browser only for the boundaries that require them.**
