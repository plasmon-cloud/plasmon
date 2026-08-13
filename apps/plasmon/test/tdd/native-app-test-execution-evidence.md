# Luna-C executable evidence

## Independently executed

- Verification commands run on 2026-08-13: `git fetch origin --prune`, branch and
  HEAD checks, live GitHub issue/PR queries, source/test audits, and focused
  document/photos/package source inspection.
- Existing deterministic Photos fullscreen helper tests and DocumentSession
  tests were inspected as current evidence; no product behavior was changed.
- The new #179 RED is intentionally run explicitly with:
  `bun test ./apps/plasmon/test/tdd/.red/issue-179.red.test.ts`.

## Browser-blocked

No `local.ndeploy.session.json` was present in the worktree at audit time. The
installed Neutron/browser gates (#67, #89, #107, #121, #180, #202) therefore
remain browser/package specification or closure audits, not fabricated REDs.

## Code-inspected only

Worker creation/communication, Firefox opaque-origin behavior, denied-policy
Photos containment, codec decode, final installed fixture, and js-dos storage
bootstrap require the packaged browser environment. Package structural tests,
canvas/readiness markers, and simulated fullscreen helpers do not upgrade those
claims.
