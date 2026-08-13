# Luna-A r2 Desktop / FileManager / filesystem closeout

Date: 2026-08-13
Branch: `tdd/r2/luna-a-desktop`
Integrated source inspected: `origin/release/0.1.0-r2`
`f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`
Harness: `/home/bhare/plasmon/agents/control/HARNESS_READY` present

## Scope and evidence integrity

This closeout covers Desktop, FileManager, filesystem-facing UX, resource
semantics, placement composition, and browser/package boundaries assigned to
Luna-A. It contains no product implementation and does not modify active
implementation packets. Integrated release source, canonical Issues, milestone
metadata, live TDD queue, scoped README/AGENTS files, permanent tests, and
existing browser specs were inspected.

A source inspection is recorded as code-inspected only. Playwright listing is
syntax validation, not browser execution. The local packaged browser claims
below are blocked by the missing matching session journal:

```text
/home/bhare/plasmon/agents/luna-a/repo/local.ndeploy.session.json
```

No reinstall or second PocketIC fleet was started.

## Live integration poll

At the follow-up poll, `origin/release/0.1.0-r2` remained
`f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`. PR #208/#65 and PR #210/#51 were
still open with required checks green; PR #211/#190 was open with kernel/Fast
Bun checks in progress; PR #204/#191 remained open with packaged specialist and
refactor-smoke failures despite successful kernel/Fast Bun checks. These active
packets remain fenced and were not modified. The dependency graph was refreshed
accordingly.

## Canonical inventory

The exhaustive issue table is in
`r2-luna-a-desktop-filemanager-fs-inventory.md`. Its dispositions are:

- **Already green / closure evidence:** #44 complete canonical shortcut
  acceptance, #45 deterministic Recycle Bin core, #108 deterministic navigation,
  #178 integrated resource semantics,
  #189 dependency, #192 placement implementation, and older #31/#40/#47/#70/
  #77/#80 closures.
- **Browser boundary/specification:** #45 packaged launch/render, #93 geometry,
  #94 media thumbnail lifecycle, #110 packaged preference persistence, and #171
  installed Element icon/request budget.
- **Dependency/readiness:** #92 waits for integrated #65 operation vocabulary;
  #195 characterization waits for #191; #196 waits for #195/#173; #201 is late
  cleanup only.
- **Staging refresh:** #172's composed gate must run against integrated #192;
  the stale lane failure is not an integrated-release verdict.
- **Active ownership — do not touch:** #51/#65/#66/#86/#95/#173/#174/#182/
  #190/#191 and other lane-owned concrete packets.

## Produced acceptance and audit artifacts

- `issue-44-closure-audit.md`
- `issue-45-closure-audit.md`
- `issue-92-operation-model-consumption.md`
- `issue-93-browser-geometry-spec.md`
- `issue-94-thumbnail-authority-map.md`
- `issue-94-eligibility-contract.md`
- `issue-94-browser-lifecycle-contract.md`
- `issue-108-closure-audit.md`
- `issue-110-packaged-persistence-contract.md`
- `issue-171-installed-browser-spec.md`
- `issue-171-request-budget-contract.md`
- `issue-172-closure-audit.md`
- `issue-178-integrated-closure-audit.md` and authority/consumer/precedence maps
- `desktop-filemanager-post-189-consumer-audit.md`
- `filesystem-nodeid-mutation-acceptance-matrix.md`
- FileManager command, selection/focus, drag/drop, and failure-state matrices
- `desktop-post-192-placement-authority-audit.md`
- `desktop-recomposition-corpus.md`
- `luna-a-red-promotion-ledger.md`
- `luna-a-invalid-superseded-packets.md`

The invalid-packet index quarantines cast-based #178, test-local Favorites #182,
old stacking-only #66, vertical-list #173, incorrect-health #190, and stale
implementation-coupled #191 evidence. These are not promotion evidence.

## Executed tests

Focused deterministic validation:

```text
bun test apps/plasmon/src/native-apps/recycle-bin/model.test.ts \
  apps/plasmon/test/trashLifecycle.test.ts \
  apps/plasmon/test/fileManagerDelete.test.ts
```

Result: **8 passed, 0 failed, 73 expect() calls**.

Additional focused authorities run during this phase:

```text
bun test apps/plasmon/src/os/file-manager/create-shortcut.test.tsx \
  apps/plasmon/src/native-apps/explorer/navigation.test.ts \
  apps/plasmon/src/os/file-manager/polish.test.tsx \
  apps/plasmon/src/os/desktop/layout.test.ts \
  apps/plasmon/src/os/neutron/icon-resolver.test.ts
```

Result: **33 passed, 0 failed, 123 expect() calls**.

Browser syntax validation:

```text
npx playwright test --list test/e2e/plasmon-image-thumbnails-93.spec.ts
```

Result: one test listed. No packaged browser execution was claimed.

The composed #172 gate was executed against the stale lane and intentionally
failed its overlap assertion; this is recorded as **WAIT FOR STAGING REFRESH**,
not as a release verdict.

## Promotion gaps and final handoff

D/testing must promote only after:

1. refreshing this TDD lane to integrated #192 and rerunning the #172 composed
   gate;
2. reusing a matching supervised packaged session to execute #45/#93/#94/#110/
   #171 browser claims;
3. consuming accepted #65 vocabulary before any #92 gate;
4. preserving active ownership fences and separating Native Apps/Luna-C and
   Shell/Windowing/Luna-B evidence.

No browser RED is reported for the missing session journal. No new production
RED is manufactured for already-green behavior. The branch must be rechecked
for a clean worktree after the final documentation commit.
