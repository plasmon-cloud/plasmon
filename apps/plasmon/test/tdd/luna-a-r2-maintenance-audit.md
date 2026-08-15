# Luna-A r2 maintenance pass

Refresh: `origin/release/0.1.0-r2` at
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.

Branch: `tdd/r2/luna-a-desktop`. No production implementation or active Sol
branch was modified.

## Queue reconciliation

- #195 was claimed through `todoctl` and completed as **ALREADY GREEN**.
  PR #213 is merged and #195's adapter decomposition is integrated.
- #92 is **GREEN IN R2**; PR #223 merged at
  `34e5daea6b59e66a7980a892df90a61729ffd7c5` and its promoted RTL tests pass.
- #196 is integrated through merged PR #215 and is no longer pending runway
  implementation.

## Sol 1 runway / PR #223 promotion audit

PR #223 consumes the merged #65 operation authority and the #195 pointer
adapter. It changes only the accepted move-operation seams: `move` operation
kind, ordered observer callbacks, operation presentation, pointer-adapter
wiring, and focused Bun/RTL tests. It does not recreate FileManager authority,
view strategies, FileEntry presentation, or a second operation model.

The original #92 RED was reproduced before PR #223; current release promotion
was verified with the ordinary regression:

```text
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/rtl/issue-92.test.tsx
# 3 passed, 0 failed
```

PR #223 consumes the RED through the merged FileManager operation seam. No
active implementation branch was modified.

No actual **REFACTOR RED GAP** was found: #195's adapter boundary remains
usable, and #223's changes stay below the FileManager composition root.

## Packet truth

- **#169:** RED consumed; PR #221 merged at
  `02a248e43342a7fc82a17ba19cab0ac471f9cbbb`.
- **#193:** packet remains valid; PR #219 is active ownership. No new RED was
  added or its branch touched.
- **#194:** PR #230 is merged; remaining #175 geometry is browser-owned.
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

**None for Luna-A.** Remaining gaps are #193 active implementation ownership
and unexecuted browser-boundary evidence; neither is a Luna-A harness gap.
