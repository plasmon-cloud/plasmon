# Desktop post-#192 placement authority audit

Refresh: release `f4ac3b4`; #192 has no active PR and is integrated in release
history. The Luna staging worktree is stale relative to that integrated source,
so source-level findings below are **CODE-INSPECTED ONLY / WAIT FOR STAGING
REFRESH** where they depend on the integrated controller.

| Finding | Location/authority | Classification | Protection/evidence |
|---|---|---|---|
| deterministic allocation | integrated #192 controller in release; stale lane still exposes `allocateDesktopPositions` | controller authority | #192 manager tests; composed #172 must run at integrated head |
| persisted position parse/write | `Desktop.tsx::parseDesktopPositions`, `persistDesktopPositions` | persisted-position adapter | Desktop/layout tests; verify integrated replacement |
| user drag clamp | `repositionDesktopNodes` in stale lane / corresponding integrated adapter | user-drag adapter invoking controller | layout tests; browser pointer boundary only |
| FileManager transform during drag | `FileManager.tsx` `translate3d` | browser preview mechanism, not final policy | #66 active packet; do not broaden |
| workspace bounds | Desktop callback receives measured bounds | adapter input | no independent browser proof of all viewport cases |
| collision repair | must be integrated controller only | suspicious duplicate if outside #192 | current stale source allocator has collision scan; exact release source needs staging refresh |
| out-of-bounds repair | controller/geometry authority | controller policy | #192 integrated tests; no Shell duplicate found by source search |
| resize reconciliation | Desktop/FileManager receives workspace geometry | adapter/controller boundary | browser geometry not required unless real layout claim |
| ordering assumptions | `orderedNodes` from FileManager snapshot | deterministic input ordering | FileManager sort/list contract |
| stale position cleanup | active NodeIds filtered by allocator | controller/presentation cleanup | current layout helper evidence; integrated confirmation pending |

## Refactor RED gap

No honest new RED should assert that a particular function/file owns placement.
The meaningful future gate is composed behavior: Trash restore, occupied slot,
incumbent stability, deterministic recomposition. The existing
`issue-172.composed.red.test.ts` intentionally fails on the stale pre-#192 lane:
collision remains true. Run it against integrated #192 before closure.
