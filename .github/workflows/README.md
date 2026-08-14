# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters then may not schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

CI may retain Playwright retries for traces, diagnostics, and classification, but a retry must never convert a failed test attempt into a green release gate. The shared root Playwright configuration must fail on flaky tests in CI: first-attempt pass is green, fail-then-pass is red, and exhausted retries are red.

`test/ci/verify-playwright-gate.mjs` exercises those three exit-code cases through the shared configuration without launching a browser. Keep that contract proof in the Packaged Smoke path when changing shared Playwright gate semantics. Merge enforcement of packaged browser status contexts is a separate GitHub ruleset responsibility tracked by #227.

## r2 packaged browser required-status contract

The repository ruleset `Require checks` (ruleset ID `20729255`) is the merge-enforcement source for `refs/heads/release/*`, including `release/0.1.0-r2`. Its required-status contract preserves `kernel` and `Fast Bun tests` and requires these exact packaged browser job contexts:

- `Packaged refactor smoke`
- `Packaged Playwright specialist acceptance`
- `Packaged browser persistence`

For r2 pull requests, each required Plasmon browser workflow schedules on every PR and **always runs its real package/browser workload**. Do not add `pull_request.paths`, PR base/head changed-file detectors, relevance outputs, or step/job guards that can turn a required browser context green without executing its real workload. This is required for stacked-PR safety: every exact PR head must exercise the complete required browser safety net inherited from its ancestors.

Direct-push applicability is separate from PR validation. Existing explicit push branches/path filters may remain where they are part of the maintained release contract; in particular, the specialist workflow preserves direct-push coverage for `version-0.1.0-os` and `release/0.1.0-r2` with its existing path filter.

`test/ci/verify-required-browser-gates.mjs` protects this PR-always-run contract, the stable context names, the real gate commands, #225 direct-push behavior, and #226 fail-on-flaky proof. Do not mask failures with `continue-on-error` and do not add a ruleset bypass as a substitute for a passing real gate.
