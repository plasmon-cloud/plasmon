# Luna-A r2 maintenance pass

Refresh: `origin/release/0.1.0-r2` at
`5a6c9bb3d46d536c60a41382d5e3754539753dcd`.

Branch: `tdd/r2/luna-a-desktop`. No production implementation or active Sol
branch was modified.

## Queue reconciliation

- #195 was claimed through `todoctl` and completed as **ALREADY GREEN**.
  PR #213 is merged and #195's adapter decomposition is integrated.
- #92 remains **TDD:RTL RED**, with active implementation ownership in PR #223.
- #196 is integrated through merged PR #215 and is no longer pending runway
  implementation.

## Sol 1 runway / PR #223 audit

PR #223 consumes the merged #65 operation authority and the #195 pointer
adapter. It changes only the accepted move-operation seams: `move` operation
kind, ordered observer callbacks, operation presentation, pointer-adapter
wiring, and focused Bun/RTL tests. It does not recreate FileManager authority,
view strategies, FileEntry presentation, or a second operation model.

The preserved #92 RED still fails against the current release at the missing
accessible status during a delayed real `FsService.move`:

```text
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/tdd/.red/issue-92.red.ui.test.tsx
# intentional failure: Received null for role=status
```

The active PR's focused branch test run was inspected without modifying that
branch. Its deterministic tests pass, and its RTL suite has one owned test
failure in the partial-failure case: the test searches for the bare failure
string although production exposes it inside the complete operation-status
message. This is an active implementation/test issue, not a Luna-A refactor
RED gap. Luna-A must not edit PR #223.

No actual **REFACTOR RED GAP** was found: #195's adapter boundary remains
usable, and #223's changes stay below the FileManager composition root.

## Packet truth

- **#169:** current headless RED remains reproducible; PR #221 is active
  implementation ownership. Packet updated with current SHA and ownership.
- **#193:** packet remains valid, but PR #219 is active ownership. No new RED
  was added or packet branch touched.
- **#194:** remains blocked by #169/PR #221 and #175 geometry.
- **#195:** integrated/ALREADY GREEN; packet updated from pre-merge broad-root
  language to the merged adapter architecture.
- **#196:** integrated/ALREADY GREEN through PR #215; strategy and RTL guards
  pass at current head. Packet updated from implementor-ready to preservation
  fence.
- **#197:** remains a Luna-B Shell handoff; no competing implementation packet
  was modified.

## Verification

Current release focused FileManager guard set:

```text
17 passed, 0 failed, 48 expect() calls
```

Current release #196 RTL strategy guard with canonical Happy DOM preload:

```text
1 passed, 0 failed, 9 expect() calls
```

Current release #169 RED gate:

```text
0 passed, 1 intentional failure
```

No packaged browser session was available in this worktree. This remains an
operational browser block, not a product RED or HARNESS GAP.

## HARNESS GAP

**None for Luna-A.** The remaining gaps are active implementation ownership
(#92/#169/#193) and the packaged browser session operational block.
