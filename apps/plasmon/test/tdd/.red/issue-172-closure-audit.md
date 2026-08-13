# Issue #172 closure audit — current #192 integration

Date: 2026-08-13
Integrated release inspected: `origin/release/0.1.0-r2` at
`f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.

PR #205/#192 is integrated. The long-lived Luna branch is pre-#192, so the
composed gate was copied into a clean detached worktree at the exact integrated
release for execution. No production code was changed.

## Acceptance matrix

| #172 criterion | Classification | Evidence |
|---|---|---|
| Restore to an unoccupied prior slot preserves original coordinates | PROVEN | integrated #192 layout tests and composed test |
| Restore to occupied slot does not overlap existing icon | PROVEN | integrated #192 controller plus composed test |
| Restored resource gets deterministic free placement | PROVEN | composed test asserts a free slot and stable recomposition |
| Existing occupant does not move | PROVEN | composed test uses incumbent priority and exact coordinate assertions |
| Unrelated positioned icons do not move | PROVEN | composed test asserts unrelated coordinates in both free and occupied cases |
| Stable NodeId/Trash restore behavior remains unchanged | PROVEN | composed test and existing `desktopCore.test.ts`/Trash lifecycle |
| Pure layout plus smallest composed Desktop/Trash regression | PROVEN | current controller seam plus two real headless Trash/restore tests |

## Executable gate

`apps/plasmon/test/tdd/.red/issue-172.composed.red.test.ts` uses the current
`reconcileDesktopPositions` controller, the real headless Plasmon filesystem,
real `FilesystemTrashService`, real NodeId-backed resources, and the Desktop
incumbent-ID contract. It proves both free-slot and occupied-slot restore paths,
original NodeId/name/parent authority, incumbent/unrelated coordinate stability,
non-overlap, and idempotent recomposition.

The long-lived branch correctly cannot execute this current test because it is
pre-#192 (`reconcileDesktopPositions` is absent there). A clean detached
worktree at the exact integrated release was used instead:

```text
bun test /tmp/plasmon-r2-172/apps/plasmon/test/tdd/.red/issue-172.composed.red.test.ts
```

Result: **2 passed, 0 failed, 13 expect() calls**.

The exact integrated release controller, layout, filesystem, and Trash lifecycle
suite was also executed:

```text
bun test /tmp/plasmon-r2-172/apps/plasmon/src/os/desktop/issue-192.test.ts \
  /tmp/plasmon-r2-172/apps/plasmon/src/os/desktop/layout.test.ts \
  /tmp/plasmon-r2-172/apps/plasmon/src/os/fs/desktopCore.test.ts \
  /tmp/plasmon-r2-172/apps/plasmon/test/trashLifecycle.test.ts
```

Result: **18 passed, 0 failed, 51 expect() calls**. This is deterministic
headless evidence; no browser boundary is involved. Trash semantics remain
outside placement authority.
