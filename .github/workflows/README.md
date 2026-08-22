# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters then may not schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

CI may retain Playwright retries for traces, diagnostics, and classification, but a test retry must never convert an initial failed test execution into a green release gate. The shared root Playwright configuration must fail on flaky tests in CI: pass without a test retry is green, fail-then-pass is red, and exhausted retries are red.

`test/ci/verify-playwright-gate.mjs` exercises those three exit-code cases through the shared configuration without launching a browser. Keep that contract proof in the Packaged Smoke path when changing shared Playwright gate semantics. Merge enforcement of packaged browser status contexts is a separate GitHub ruleset responsibility tracked by #227.

## r2 complete Plasmon pull-request and release-integration test contract

For `release/0.1.0-r2`, every eligible production Plasmon test that can honestly run in CI must execute on **every pull request**, independent of changed files. This rule exists for stacked-PR safety: a descendant PR contains ancestor behavior, so its exact PR head must exercise the complete Plasmon safety net rather than only tests guessed relevant to the child diff.

After integration, a Plasmon-relevant push to `release/0.1.0-r2` must also schedule the same five required gate contexts used for PR merge evidence so the combined release tree is validated rather than relying only on separate pre-merge heads.

The required ownership model is:

- `Fast Bun tests` — automatically discovers ordinary production `*.test.*` / `*.spec.*` files under `apps/plasmon/src/**` and `apps/plasmon/test/**`, excluding the separately owned RTL/package classes, then runs the complete `apps/plasmon/test/rtl/**` Happy DOM/user-event lane;
- `Packaged refactor smoke` — performs real package/provision preparation, runs `apps/plasmon/test/package.test.ts` against the produced package output, proves #226 fail-on-flaky behavior, then runs the complete Smoke Playwright group;
- `Packaged Playwright specialist acceptance` — performs real package/provision preparation and runs the complete Specialist spec inventory with `--workers=1 --grep-invert @r2-quarantine`; only repository-authorized active quarantine debt may carry `@r2-quarantine`;
- `Packaged browser persistence` — performs real package/provision preparation and runs the retained-profile persistence spec;
- `kernel` — remains a required repository context and is not weakened by the Plasmon inventory work.

No Plasmon PR lane may use `pull_request.paths`, PR base/head changed-file selection, relevance outputs, or step/job guards to avoid its real workload. Direct release-push coverage must preserve all five required contexts. Existing Fast/Specialist release-push path filters may remain where they describe Plasmon-relevant integration changes, but Smoke, Persistence, and Kernel must not disappear after those merges.

`test/ci/plasmon-test-inventory.mjs` is the source-controlled classification for the Plasmon production test inventory. `test/ci/verify-plasmon-test-inventory.mjs` recursively discovers application tests plus every Playwright `*.spec.*` under `test/e2e/**`, proves every Plasmon browser spec belongs to a required Smoke/Specialist/Persistence lane, requires every neighboring browser spec to have an explicit non-Plasmon owner, verifies the required workflows really execute those owners, protects the serialized Specialist state boundary and narrow quarantine contract, and fails on any unclassified browser spec. Fast CI also runs the verifier with `--self-test-orphan`; that self-test classifies and injects a synthetic **nested** Playwright orphan and must reject it so neither a new filename nor a new subdirectory can silently evade the guard.

Explicit non-production boundaries are narrow:

- intentionally RED TDD staging under `apps/plasmon/test/tdd/.red/**` is specification input, not ordinary regression execution;
- helpers/fixtures such as the BrowserHealth ledger or demo-environment coordinator are not test files themselves, but their behavior is exercised by production tests;
- shared CI-contract probes such as `test/ci/playwright-gate.probe.spec.ts` belong to CI semantics rather than Plasmon product inventory and remain executed by their owning verifier.

Do not add an exclusion merely to make CI green. If an otherwise eligible Plasmon test cannot run in hosted CI, document the unavailable capability and its ownership explicitly before excluding it. A real product failure must remain visible and be routed to the owning product lane; CI/harness failures belong to Testing/Integration and must not be hidden by weakening assertions.

The executable quarantine ledger is `test/ci/QUARANTINED_BROWSER_TESTS.md`. It must match the actual `@r2-quarantine` tags and Specialist filtering exactly.

## r2 packaged browser required-status contract

The repository ruleset `Require checks` (ruleset ID `20729255`) is the merge-enforcement source for `refs/heads/release/*`, including `release/0.1.0-r2`. Its required-status contract preserves `kernel` and `Fast Bun tests` and requires these exact packaged browser job contexts:

- `Packaged refactor smoke`
- `Packaged Playwright specialist acceptance`
- `Packaged browser persistence`

For r2 pull requests, each required Plasmon browser workflow schedules on every PR and **always runs its real package/browser workload**. Do not add `pull_request.paths`, PR base/head changed-file detectors, relevance outputs, or step/job guards that can turn a required browser context green without executing its real workload.

For post-merge r2 validation, a Plasmon-relevant push to `release/0.1.0-r2` must produce all five required contexts: `kernel`, `Fast Bun tests`, `Packaged refactor smoke`, `Packaged Playwright specialist acceptance`, and `Packaged browser persistence`. The release branch is the combined integration artifact, so a green set of separate PR heads is not a substitute for validating that integrated tree.

`test/ci/verify-required-browser-gates.mjs` protects the PR-always-run contract, stable context names, real gate commands, direct-push coverage, and #226 fail-on-flaky proof. It also verifies that all five required workflow definitions retain `release/0.1.0-r2` push coverage. Do not mask failures with `continue-on-error` and do not add a ruleset bypass as a substitute for a passing real gate.

## Automatic r2 flake probing

`Plasmon Flake Probe` is a diagnostic workflow for stress-testing test boundaries. It is **not** one of the five required r2 release gates and must not replace, cheap-green, bypass, or weaken those gates.

The workflow is path-triggered only when Plasmon tests or their test infrastructure change: ordinary Plasmon test files, root Playwright specs, the test harness, package/toolchain configuration, or the workflow itself. Unrelated PRs do not create a skipped flake-probe check. A suspected flake caused only by production changes can be opted in by adding the `ci:flake-probe` label; `.github/workflows/plasmon-flake-probe-label.yml` dispatches an exact-head probe for that label without broadening the automatic path-triggered workflow.

Automatic test-change probes run the combined `all` target: ten independent **probe iterations**, each on a fresh hosted runner and fresh package/PocketIC environment. The target runs the Plasmon fast Bun/RTL suite and the automatically discovered Specialist browser inventory. Browser execution remains serialized with `--workers=1`, and Playwright test retries remain disabled with `--retries=0` so every observed failure remains evidence. Manual dispatch additionally provides bounded named targets for known flaky boundaries such as right snap, left snap, Monaco, EmulatorJS, or window lifetime.

Flake Probe terminology is intentionally distinct from GitHub Actions and test-runner terminology:

- **workflow run** / `run_number` — one GitHub Actions workflow run;
- **workflow run attempt** / `run_attempt` — a GitHub Actions rerun of that workflow run;
- **probe iteration** — one of the ten fresh Flake Probe executions;
- **test retry** — a retry performed by the test runner when enabled.

New Flake Probe result files emit `iteration=<n>` plus explicit `run_number` and `run_attempt` metadata, and iteration artifacts use `flake-probe-iteration-*` names. `test/ci/summarize-flake-probe.mjs` remains backward compatible with historical result files by accepting the old `attempt=<n>` field as a legacy alias while always reporting that execution as a probe iteration. This compatibility is read-only: new workflow output must not emit the legacy field.

New `test/e2e/plasmon-*.spec.*` files default to the Specialist inventory. Existing Smoke, Persistence, and explicitly quarantined ownership remains declared in `test/ci/plasmon-test-inventory.mjs`; the inventory verifier fails if a browser spec is otherwise unclassified. This prevents a new test from silently escaping the probe.

A `10/10` probe means stability was observed for that exact head; it is not mathematical proof that a test can never flake. A result below `10/10` is positive evidence of an intermittent, deterministic, or infrastructure failure and must be classified by the CI owner. Product agents should change product code only when exact evidence establishes product ownership.

`test/ci/verify-flake-probe.mjs` protects the path trigger, exact-head checkout, ten-fresh-probe-iteration matrix, retry-zero/worker-one execution, automatic Specialist discovery, real package/provision path, rerun-safe iteration artifacts, backward-compatible result parsing, and aggregate summary contract.
