# Plasmon test agent instructions

## Scope

Applies to `apps/plasmon/test/**`. Also follow `apps/plasmon/AGENTS.md`, [`../TESTING.md`](../TESTING.md), and the nearest subsystem instructions for the behavior under test.

`createHeadlessPlasmonEnvironment()` is the canonical deterministic cross-system composition. It uses the real production `PlasmonServices` graph and replaces only true environment boundaries. For **new high-level deterministic workflows representing legitimate OS operations**, use the production semantic OS API exposed as `env.os` rather than adding new raw `environment.services` choreography or using the legacy convenience helpers. Do not create feature-specific fake filesystem, association, open, Process, Windowing, Shell, Desktop, native-app, or runtime implementations in this directory.

`renderPlasmon()` is the bounded React adapter around that same headless composition. It exposes the same `environment.os` for legitimate setup and resulting-state inspection. It is not a second OS model and must not grow into a Page Object Model.

The legacy headless `node()`, `open()`, `processes()`, and `windows()` conveniences remain only to avoid a broad compatibility migration. Do not use them in new high-level tests when `env.os` expresses the operation. Focused subsystem/unit tests are different: they should continue calling the owning production model/service/controller/command directly rather than being forced through the OS API (`OsApi`).

## Required lanes

Run the smallest focused Bun test while iterating, then run:

```sh
npm --workspace neutron-plasmon test
```

before handoff. The fast command includes deterministic/headless coverage plus the bounded RTL layer.

Run only the RTL adapter layer with:

```sh
npm --workspace neutron-plasmon run test:ui
```

Use package or Playwright lanes only when the acceptance claim crosses those boundaries. Do not use repository-root `npm test` as the normal Plasmon test command.

If Bun is unavailable locally, push the Issue branch and use **Plasmon Fast CI**. Handoffs must report the focused command/result and fast-suite result, whether local or CI.

## HARNESS GAP intake

Classify a missing test capability before adding infrastructure:

- **A — existing production seam:** if the behavior is a focused subsystem claim, call the owning production model/service/controller/command directly. If it is a high-level cross-system workflow and `env.os` already expresses the legitimate OS operation, use `env.os`. Do not add a helper merely to rename either call.
- **B — missing legitimate OS API capability:** the workflow is deterministic, cross-system, and represents an OS operation a normal authorized automation caller could reasonably perform, but `env.os` cannot express it. Treat this as a candidate production OS API gap and extend the dependency-light `OsApi` contract/adapter only when the capability is genuinely durable; do not encode the workflow as raw service choreography, a test-only business-semantic helper, or Playwright clicks.
- **C — missing test adapter/helper:** production behavior is sufficient but repeated deterministic setup, settlement, external-effect control, or inspection needs a small reusable test-only builder/adapter. Keep it behavior-free and beside `env.os`; do not put test superpowers on the production OS API.
- **D — missing RTL composition:** the claim belongs to React/DOM adapter behavior and needs `renderPlasmon()`, Happy DOM setup, or a small semantic DOM helper. Do not move OS policy into this layer.
- **E — deterministic production behavior trapped in React:** extract the smallest behavior into the owning production controller/model/command, preserve behavior, and add focused coverage there before exercising the thin React adapter.
- **F — genuine browser/package boundary:** the claim depends on installed archives, Neutron installation/runtime, iframe/sandbox behavior, real layout/hit-testing, workers, Monaco/runtime initialization, media, fullscreen/download/file-picker, or another browser-owned facility. Keep the Playwright proof minimal and do not re-prove deterministic OS semantics there.

Testing / Integration owns shared B-E harness/API repairs. Domain implementors should raise a `HARNESS GAP` instead of inventing local infrastructure. F remains an explicit packaged/browser boundary.

## Testing rules

- Test the authority that owns the behavior; do not preserve obsolete architecture merely because source text is easy to assert.
- Prefer executable production behavior over broad source-string assertions.
- Put testable user-action semantics in real production models/services/controllers/commands. Tests should invoke the same logic as React adapters.
- New high-level deterministic OS workflows should use `env.os` when the required legitimate capability exists; do not add new direct service-graph choreography as the permanent test language for those workflows.
- If `env.os` lacks a legitimate durable OS operation, evaluate it as an OS API gap before adding browser automation or a feature-specific helper.
- Keep test-only powers such as global settlement, programmable failures/defer, fake call recording, clock control, transport faults, and impossible-state construction outside the production OS API.
- When several UI surfaces expose one operation, add cross-surface tests against the shared authority rather than duplicating semantics in each surface.
- Use `renderPlasmon()` only when React/browser-adapter behavior itself matters. Prefer accessible role/name/state queries and `userEvent`; `data-testid` is exceptional.
- Keep setup/builders small and domain-neutral. Repeated use must justify shared helpers.
- Include negative cases for protection, authorization, persistence, projections, and forbidden operations where applicable.
- Keep package/browser tests for claims that actually cross those boundaries.
- Keep browser tests semantic and redesign-resistant; avoid assertions tied to incidental DOM nesting, CSS geometry, or screenshots unless visual fidelity is the contract being tested.

## Installed Plasmon acceptance environment

The canonical deployment rules are in [`../TESTING.md`](../TESTING.md). The repository-owned coordinator is `../../test/e2e/plasmon-deployment-environment.ts`; it requires an explicit `local` or `demo` scope and derives the required workspaces from that scope's manifest.

`plasmon-local.ndeploy.json` is the bounded local/CI source of truth used by the required Plasmon packaged browser lanes. `plasmon.ndeploy.json` is the fuller demo deployment. Do not interchange the `plasmon:local:*` and `plasmon:demo:*` command families, and do not add a second hand-maintained package list, a second PocketIC implementation, or test-only product behavior.

Preserve the real boundary:

```text
package
  -> .neutron archive
  -> neutron-provision install/reinstall
  -> Neutron
  -> Plasmon
  -> /Apps projection
  -> canonical filesystem/open dispatch
```

Authenticated Neutron applications remain Kernel-owned sibling tiles. Tests must not create Plasmon-native fake processes/windows for them.

## Failures and boundaries

When a test and an accepted product/architecture rule disagree, determine which is stale. Do not automatically change production code to satisfy a brittle test, and do not weaken a valid test merely to make CI green.

If a required capability is actually missing from Kernel or shared Neutron tooling, identify and escalate that boundary rather than emulating it in Plasmon tests.

A green fast suite does not supersede a failing packaged workflow or explicit manual acceptance failure.
