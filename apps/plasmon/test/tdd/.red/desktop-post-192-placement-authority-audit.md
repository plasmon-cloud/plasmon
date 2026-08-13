# Desktop post-#192 placement authority audit

Refresh: release `f4ac3b4`; #192 has no active PR and is integrated in release
history. The long-lived Luna staging worktree remains pre-#192, but the exact
release source was executed in a clean detached worktree for #172 closure.

| Finding | Location/authority | Classification | Protection/evidence |
|---|---|---|---|
| deterministic allocation | integrated #192 `reconcileDesktopPositions` controller | controller authority | #192 tests plus #172 composed release-head execution |
| persisted position parse/write | `Desktop.tsx::parseDesktopPositions`, `persistDesktopPositions` | persisted-position adapter | Desktop/layout tests; verify integrated replacement |
| user drag clamp | `repositionDesktopNodes` in stale lane / corresponding integrated adapter | user-drag adapter invoking controller | layout tests; browser pointer boundary only |
| FileManager transform during drag | `FileManager.tsx` `translate3d` | browser preview mechanism, not final policy | #66 active packet; do not broaden |
| workspace bounds | Desktop callback receives measured bounds | adapter input | no independent browser proof of all viewport cases |
| collision repair | integrated controller only | no duplicate policy found | #172 composed test proves incumbent priority and deterministic free placement |
| out-of-bounds repair | controller/geometry authority | controller policy | #192 integrated tests; no Shell duplicate found by source search |
| resize reconciliation | Desktop/FileManager receives workspace geometry | adapter/controller boundary | browser geometry not required unless real layout claim |
| ordering assumptions | `orderedNodes` from FileManager snapshot | deterministic input ordering | FileManager sort/list contract |
| stale position cleanup | active NodeIds filtered by allocator | controller/presentation cleanup | current layout helper evidence; integrated confirmation pending |

## Closure result

No source-shape RED is required. The meaningful composed behavior gate covers
Trash restore, free/occupied slots, incumbent stability, unrelated positions,
NodeId identity, and deterministic recomposition. It passed against the exact
integrated #192 source; placement remains solely controller-owned.
