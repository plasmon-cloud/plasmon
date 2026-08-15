# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters then may not schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

CI may retain Playwright retries for traces, diagnostics, and classification, but a retry must never convert a failed test attempt into a green release gate. The shared root Playwright configuration must fail on flaky tests in CI: first-attempt pass is green, fail-then-pass is red, and exhausted retries are red.

`test/ci/verify-playwright-gate.mjs` exercises those three exit-code cases through the shared configuration without launching a browser. Keep that contract proof in the Packaged Smoke path when changing shared Playwright gate semantics. Merge enforcement of packaged browser status contexts is a separate GitHub ruleset responsibility tracked by #227.

## r2 complete Plasmon pull-request test contract

For `release/0.1.0-r2`, every eligible production Plasmon test that can honestly run in CI must execute on **every pull request**, independent of changed files. This rule exists for stacked-PR safety: a descendant PR contains ancestor behavior, so its exact PR head must exercise the complete Plasmon safety net rather than only tests guessed relevant to the child diff.

The required PR ownership model is:

- `Fast Bun tests` — automatically discovers ordinary production `*.test.*` / `*.spec.*` files under `apps/plasmon/src/**` and `apps/plasmon/test/**`, excluding the separately owned RTL/package classes, then runs the complete `apps/plasmon/test/rtl/**` Happy DOM/user-event lane;
- `Packaged refactor smoke` — performs real package/provision preparation, runs `apps/plasmon/test/package.test.ts` against the produced package output, proves #226 fail-on-flaky behavior, then runs the complete Smoke Playwright group;
- `Packaged Playwright specialist acceptance` — performs real package/provision preparation and runs the complete Specialist spec inventory with `--workers=1 --grep-invert @r2-quarantine`; only the #244 right-snap/snap-preview acceptance and #245 EmulatorJS readiness/canvas/core-start acceptance may carry the active `@r2-quarantine` tag. The serialized harness keeps #250 demo-game and #251 sibling-window lifetime coverage required;
- `Packaged browser persistence` — performs real package/provision preparation and runs the retained-profile persistence spec;
- `kernel` — remains a required repository context and is not weakened by the Plasmon inventory work.

No Plasmon PR lane may use `pull_request.paths`, PR base/head changed-file selection, relevance outputs, or step/job guards to avoid its real workload. Direct-push applicability is separate and may retain explicit branch/path filters where already part of the maintained release contract.

`test/ci/plasmon-test-inventory.mjs` is the source-controlled classification for the Plasmon production test inventory. `test/ci/verify-plasmon-test-inventory.mjs` recursively discovers application tests plus every Playwright `*.spec.*` under `test/e2e/**`, proves every Plasmon browser spec belongs to a required Smoke/Specialist/Persistence lane, requires every neighboring browser spec to have an explicit non-Plasmon owner, verifies the required workflows really execute those owners, protects the serialized Specialist state boundary and narrow #244/#245 quarantine contract, and fails on any unclassified browser spec. Fast CI also runs the verifier with `--self-test-orphan`; that self-test classifies and injects a synthetic **nested** Playwright orphan and must reject it so neither a new filename nor a new subdirectory can silently evade the guard.

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

Direct-push applicability is separate from PR validation. Existing explicit push branches/path filters may remain where they are part of the maintained release contract; in particular, the specialist workflow preserves direct-push coverage for `version-0.1.0-os` and `release/0.1.0-r2` with its existing path filter.

`test/ci/verify-required-browser-gates.mjs` protects this PR-always-run contract, the stable context names, the real gate commands, #225 direct-push behavior, and #226 fail-on-flaky proof. Do not mask failures with `continue-on-error` and do not add a ruleset bypass as a substitute for a passing real gate.