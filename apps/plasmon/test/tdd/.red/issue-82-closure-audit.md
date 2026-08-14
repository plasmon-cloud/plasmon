# Issue #82 — managed-root bootstrap closure audit

Refresh: `origin/release/0.1.0-r2` at
`2b6984e96647eae1f3abe5719d3a3782809ceeb9`.

Disposition: **ALREADY GREEN**. No open PR owns #82.

## Production authority

The real headless composition is `createHeadlessPlasmonEnvironment()` and its
filesystem core/bootstrap. Managed-root policy remains in `managed.ts`,
projection identity remains Neutron-owned through `NeutronProjectionService`,
and the test does not recreate bootstrap logic or imply that `/Apps` is an
installation authority.

## Criterion audit

| Canonical criterion | Integrated evidence | Result |
|---|---|---|
| empty composition establishes managed roots | `managedRootBootstrap.test.ts` asserts `/System`, `/System/Start Menu`, `/System/.Trash`, `/System/Program Files`, and `/Apps` | proven |
| repeated initialization is idempotent | same test reopens the persistent repository and asserts stable revision, one named child per root, and one projection | proven |
| repairable managed metadata is repaired | same test damages ownership/program-files/projection metadata and projection name, then reinitializes normal production composition | proven |
| unrelated user content survives | user document bytes/NodeId and custom Start Menu folder NodeId survive repair | proven |
| stable NodeIds remain stable | all managed roots, projection, user document, and custom folder retain IDs across reopen/repair | proven |
| `/Apps` remains projection-only | test removes authoritative element discovery and asserts projection disappears while `/Apps` and unrelated state remain | proven |
| production shared headless graph | test uses `createHeadlessPlasmonEnvironment({ repository, elements })` for every reconciliation | proven |
| Start Menu, Trash, Program Files, Apps coverage | explicit paths and ownership/metadata assertions in permanent test | proven |

Additional bootstrap/default-seed evidence covers legacy hidden metadata repair,
Start Menu migration by NodeId, approved native `.sys` resources, durable Root/
Apps shortcut seeding, and user deletion preservation.

## Executed integrated evidence

Executed in clean detached worktree `/tmp/plasmon-r2-92` at the exact release
head:

```text
bun test /tmp/plasmon-r2-92/apps/plasmon/test/managedRootBootstrap.test.ts \
  /tmp/plasmon-r2-92/apps/plasmon/src/os/fs/desktopCore.test.ts \
  /tmp/plasmon-r2-92/apps/plasmon/src/os/fs/defaultSeeds.test.ts \
  /tmp/plasmon-r2-92/apps/plasmon/test/headlessEnvironment.test.ts
```

Result: **12 passed, 0 failed, 74 expect() calls**.

No browser/package boundary applies. No new RED is truthful: the complete
canonical #82 behavior is already protected by the integrated production-graph
suite. This audit does not close the GitHub Issue; it supplies TDD disposition
and permanent evidence for the coordinator.
