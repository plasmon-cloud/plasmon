# GitHub Actions maintenance notes

## Ancestry-only pull requests

A pull request that changes Git ancestry while preserving the target tree byte-for-byte can have a zero-file diff. GitHub path filters then may not schedule a required workflow even though branch protection still expects its status context.

For an ancestry-only PR targeting a protected branch, run the required workflow manually with `workflow_dispatch` on the PR head when GitHub reports a required context as `expected`. Do not add unrelated product changes or weaken the required status check merely to make the PR mergeable.

## Playwright retry semantics

CI may retain Playwright retries for traces, diagnostics, and classification, but a retry must never convert a failed test attempt into a green release gate. The shared root Playwright configuration must fail on flaky tests in CI: first-attempt pass is green, fail-then-pass is red, and exhausted retries are red.

`test/ci/verify-playwright-gate.mjs` exercises those three exit-code cases through the shared configuration without launching a browser. Keep that contract proof in the Packaged Smoke path when changing shared Playwright gate semantics. Merge enforcement of packaged browser status contexts is a separate GitHub ruleset responsibility tracked by #227.

## r2 packaged browser required-status contract

The repository ruleset `Require checks` (ruleset ID `20729255`) is the merge-enforcement source for `refs/heads/release/*`, including `release/0.1.0-r2`. Its required-status contract must preserve the existing `kernel` and `Fast Bun tests` checks and add these exact packaged browser job contexts:

- `Packaged refactor smoke`
- `Packaged Playwright specialist acceptance`
- `Packaged browser persistence`

A browser context cannot safely be required if its workflow can disappear because a pull request is outside a top-level `pull_request.paths` filter. Required browser workflows therefore schedule for every pull request and perform path relevance inside the stable job: irrelevant changes terminate green without installing Nix or packaging, while relevant changes run the full installed package/browser gate. The relevance decision must use the pull request base SHA through head SHA, not only the latest commit.

`test/ci/verify-required-browser-gates.mjs` protects the repository-side always-report contract. Keep the exact job names stable, preserve the expensive-path scopes, do not mask failures with `continue-on-error`, and do not add a ruleset bypass as a substitute for a terminal required status.
