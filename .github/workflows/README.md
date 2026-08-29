# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters then may not schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

CI may retain Playwright retries for traces, diagnostics, and classification, but a test retry must never convert an initial failed test execution into a green release gate. The shared root Playwright configuration must fail on flaky tests in CI: pass without a test retry is green, fail-then-pass is red, and exhausted retries are red.

`test/ci/verify-playwright-gate.mjs` exercises those three exit-code cases through the shared configuration without launching a browser. Keep that contract proof in the Packaged Smoke path when changing shared Playwright gate semantics. Merge enforcement of packaged browser status contexts is a separate GitHub ruleset responsibility.

## Plasmon pull-request and release-integration test contract

Every eligible production Plasmon test that can honestly run in CI must execute on **every pull request**, independent of changed files. This rule exists for stacked-PR safety: a descendant PR contains ancestor behavior, so its exact PR head must exercise the complete Plasmon safety net rather than only tests guessed relevant to the child diff.

Release integration branches are a durable branch role, represented by `release/**` in workflow triggers and by `test/ci/plasmon-ci-policy.mjs` in deterministic verification. Cutting another release branch must not require copying its concrete name into each workflow. Unknown refs are not silently promoted to the release role.

A push to any release-role branch must schedule the same five required gate contexts used for PR merge evidence so the combined release tree is validated rather than relying only on separate pre-merge heads.

The required ownership model is:

- `Fast Bun tests` — automatically discovers ordinary production `*.test.*` / `*.spec.*` files under `apps/plasmon/src/**` and `apps/plasmon/test/**`, excluding the separately owned RTL/package classes, then runs the complete `apps/plasmon/test/rtl/**` Happy DOM/user-event lane;
- `Packaged refactor smoke` — performs real package/provision preparation, runs `apps/plasmon/test/package.test.ts` against the produced package output, proves fail-on-flaky behavior, then runs the complete Smoke Playwright capability group;
- `Packaged Playwright specialist acceptance` — performs real bounded package/provision preparation and runs the complete Specialist capability group with `--workers=1 --retries=0 --grep-invert @quarantine`;
- `Packaged Playwright demo acceptance` — prepares the full Demo package and runs the Demo capability group selected by the shared browser inventory rather than by a workflow-local filename list;
- `Packaged browser persistence` — performs real package/provision preparation and runs the retained-profile Persistence capability group;
- `kernel` — remains a required repository context and is not weakened by the Plasmon inventory work.

No Plasmon PR lane may use `pull_request.paths`, PR base/head changed-file selection, relevance outputs, or step/job guards to avoid its real workload. Direct release-role push coverage must preserve all required contexts.

`test/ci/plasmon-test-inventory.mjs` is the source-controlled classification for the Plasmon production test inventory. Smoke, Specialist, Demo, and Persistence are stable capability lanes. `test/ci/run-plasmon-browser-lane.mjs` executes the inventory-selected Smoke, Demo, and Persistence lanes; Specialist retains its dedicated discovery runner because it is also used by diagnostic tooling. New `test/e2e/plasmon-*.spec.*` files default to Specialist unless they are explicitly assigned to another capability or an optional profile, so a new acceptance cannot silently escape browser CI.

`test/ci/verify-plasmon-test-inventory.mjs` recursively discovers application tests plus every Playwright `*.spec.*` under `test/e2e/**`, proves every Plasmon browser spec has an explicit or safe-default owner, requires every neighboring browser spec to have an explicit non-Plasmon owner, verifies the required workflows really execute semantic lane runners rather than enumerating Plasmon filenames, protects the serialized Specialist state boundary and narrow quarantine contract, and fails on any unclassified browser spec. Fast CI also runs the verifier with `--self-test-orphan`; that self-test injects a synthetic nested Playwright orphan and must reject it so neither a new filename nor a new subdirectory can silently evade the guard.

Explicit non-production boundaries are narrow:

- intentionally RED TDD staging under `apps/plasmon/test/tdd/.red/**` is specification input, not ordinary regression execution;
- helpers/fixtures such as the BrowserHealth ledger or demo-environment coordinator are not test files themselves, but their behavior is exercised by production tests;
- shared CI-contract probes such as `test/ci/playwright-gate.probe.spec.ts` belong to CI semantics rather than Plasmon product inventory and remain executed by their owning verifier;
- browser acceptances that require a package profile unavailable to an ordinary required lane are classified as profile-specific rather than being run against an untruthful package.

Do not add an exclusion merely to make CI green. If an otherwise eligible Plasmon test cannot run in hosted CI, document the unavailable capability and its ownership explicitly before excluding it. A real product failure must remain visible and be routed to the owning product lane; CI/harness failures belong to Testing/Integration and must not be hidden by weakening assertions.

The executable quarantine authority is `test/ci/plasmon-quarantine.json`; `test/ci/QUARANTINED_BROWSER_TESTS.md` explains that authority. Active execution uses the fixed `@quarantine` marker and semantic selector tags.

## Packaged browser required-status contract

The repository ruleset `Require checks` (ruleset ID `20729255`) applies to `refs/heads/release/*`. Its required-status contract preserves `kernel` and `Fast Bun tests` and requires these exact packaged browser job contexts:

- `Packaged refactor smoke`
- `Packaged Playwright specialist acceptance`
- `Packaged browser persistence`

The Demo job is part of the packaged browser workflow and is capability-selected from the same inventory, but required-status naming remains governed by the repository ruleset rather than by release-numbered source configuration.

For pull requests, each required Plasmon browser workflow schedules on every PR and **always runs its real package/browser workload**. Do not add `pull_request.paths`, PR base/head changed-file detectors, relevance outputs, or step/job guards that can turn a required browser context green without executing its real workload.

For post-merge release validation, a push to a `release/*` branch must produce all required contexts. The release branch is the combined integration artifact, so a green set of separate PR heads is not a substitute for validating that integrated tree.

`test/ci/verify-required-browser-gates.mjs` protects the PR-always-run contract, stable context names, real gate commands, semantic Demo selection, release-role direct-push coverage, and fail-on-flaky proof. It imports `test/ci/plasmon-ci-policy.mjs`, exercises future release refs as accepted examples, and verifies unknown refs fail closed. Do not mask failures with `continue-on-error` and do not add a ruleset bypass as a substitute for a passing real gate.

## Automatic and labeled flake probing

`Plasmon Flake Probe` is diagnostic CI. It is **not** one of the required release gates and must not replace, cheap-green, bypass, or weaken those gates.

Qualifying pull-request heads retain the ten-iteration `all` baseline. When a PR changes a relevant non-quarantined Playwright acceptance, automatic characterization selects a separate 50-iteration exact-file or exact-set characterization. Multiple directly changed Playwright specs remain one narrow exact set; uncertain helper/configuration changes do not expand into fifty runs of the whole Specialist inventory.

The `ci:flake-probe` label is a separate explicit request for a fresh targeted 50-iteration probe. The label bridge accepts only same-repository pull requests whose base has the release branch role. It validates that security boundary before checking out PR code, dispatches through the PR head branch as transport, and independently pins the immutable head SHA in the probe workflow input. While the label remains present, later `synchronize` events request a fresh probe for each new exact head. Removing the label prevents future synchronize-triggered requests and does not cancel already-dispatched evidence.

A labeled probe may use `Flake-Probe-Target: test/e2e/<file>.spec.ts` with optional `Flake-Probe-Grep: <title-or-tag>`, or a documented bounded named target. Without a directive, the label selector may reuse automatic characterization only when exactly one Playwright file is resolved. Ambiguous or unresolved selection fails closed instead of launching a broad `all` or `specialist` 50-run sweep.

Quarantine is absolute across automatic, manual/direct, and labeled probes. Every direct Playwright invocation uses `--grep-invert @quarantine`; a label never turns quarantine into an opt-in execution lane.

Flake Probe terminology is intentionally distinct from GitHub Actions and test-runner terminology:

- **workflow run** / `run_number` — one GitHub Actions workflow run;
- **workflow run attempt** / `run_attempt` — a GitHub Actions rerun of that workflow run;
- **probe iteration** — one fresh Flake Probe execution inside a configured 10- or 50-iteration packet;
- **test retry** — a retry performed by the test runner when enabled.

New Flake Probe result files emit `iteration=<n>` plus explicit `iteration_count`, `run_number`, `run_attempt`, target/scope, and mode metadata. `iteration` identifies the probe slot; `run_attempt` identifies a GitHub workflow rerun. `test/ci/summarize-flake-probe.mjs` remains read-compatible with historical ten-iteration result shapes, including the legacy alias `attempt=<n>`, but new output must use the unambiguous fields.

A clean `10/10` or `50/50` probe is stability evidence for that exact SHA and scope, not mathematical proof that a test cannot flake. Baseline and characterization packets remain independent and are never flattened into one sample count. Any observed failure remains diagnostic evidence and must be classified rather than hidden with retries, sleeps, timeout inflation, broad skips, or weaker assertions.

`test/ci/verify-flake-probe.mjs` protects the baseline/automatic characterization contract. `test/ci/verify-labeled-flake-probe.mjs` separately protects release-role label targeting, same-repository validation, synchronize/removal behavior, exact-SHA dispatch transport, retry-zero/worker-one execution, and the absolute quarantine exclusion.
