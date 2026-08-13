# r2 TDD queue consistency audit

Source: `apps/plasmon/test/tdd/todo.md` on Luna-D (`e815c463`), the live authoritative `/home/bhare/plasmon/agents/control/todo.md` via `todoctl show`, all three Luna refs, and live GitHub state.

- The worktree queue contains 34 entries: A 10, B 10, C 10, D 10, all stale `[ ]` relative to the live queue. The live queue has 12 `[x]`, 8 `[~]`, and 14 `[ ]` entries at audit time (for example #51/#65 are marked `TDD:RTL RED`, while #92 and #61 are claimed). The worktree file must not be used for coordination. This is not evidence that no packet exists: Luna-A has a large `.red` packet tree while B/C have no packet commits on their published refs.
- Queue omits the milestone future Issues #169–#202 except those historical seeded entries; the master ledger is authoritative for them.
- Queue omits #155, #167, #170, #186, #187, #189, #190, #191, #192; these are implemented/future issues found through GitHub/release history and must not be lost.
- Queue has #108 although it is not in the supplied r2 inventory; retain only as a stale historical packet and resolve with Coordinator.
- No duplicate lane claim was found in the live queue. A owns the packet tree; B and C published no competing packet tree. Active implementation PRs are #204/#208/#210/#211.
- `HARNESS_READY` exists. The fast lane passed (454 Bun + 4 RTL tests).

Corrective owner/tool path: Coordinator/Testing Lead should reconcile queue using `todoctl`, not manual edits: mark integrated complete Issues, mark active PRs `[~]`, add the missing future Issue IDs with one owner, and quarantine stale A packets through the final implementor index. Do not merge the queue wholesale into release.
