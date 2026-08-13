# r2 queue assignment reconciliation (live queue)

The authoritative queue is `/home/bhare/plasmon/agents/control/todo.md`; the repository `apps/plasmon/test/tdd/todo.md` is stale and must not be used for coordination. Snapshot after `todoctl` claims: 2026-08-13.

| queue Issue | required canonical owner | current live queue state | truthful disposition / corrective action |
|---|---|---|---|
| #38 | Sharing / Agent 9 / Backend, not Plasmon UI | `[ ]` | **EXTERNAL BACKEND OWNERSHIP**; do not absorb into C. Reconcile old Sharing source against backend/package/docs and preserve fail-closed boundary. Coordinator should move/remove the misplaced C queue entry. |
| #58 | Luna-C / Native Apps + Atoms/Neutron review | `[~] claimed:luna-c` | deep C packet required; standalone vanilla Review is independent of #38. |
| #78 | Luna-A for shortcut/FileManager composition, D review | `[ ]` | A must claim the production-consumer seam after #51; D audits cross-surface promotion. |
| #79 | Luna-C Native Apps/Process close consumer, D review | `[ ]` | C must claim deep dirty-document seam; D must not invent a duplicate process/window fake. |
| #81 | Luna-B concrete Shell projection, D composition review | `[~] claimed:luna-b` | B owns packet; D consumes it for composed taskbar promotion. |
| #82 | Luna-A Filesystem bootstrap, D review | `[ ]` | A should claim because FsService/bootstrap authority is canonical; existing permanent test is adjacent but not complete #82 proof. |
| #83 | Luna-C runtime/associations, D review | `[ ]` | C must claim after #48; headless runtime selection is deterministic, browser startup stays C. |
| #89 | Luna-C Monaco/runtime path | `[~] claimed:luna-c` | deep C packet; #67/#200 browser path coordination required. |
| #107 | Luna-D Testing/Integration | `[~] claimed:luna-d` | #107 baseline audit staged in `r2-packaged-baseline-promotion-audit.md`; packaged run remains required. |
| #25 | Luna-D release-boundary audit | `[~] claimed:luna-d` | RED gate staged; current source fails removal criteria. |
| #26 | Luna-D release-boundary audit | `[~] claimed:luna-d` | RED gate staged; current legacy consumers/files remain. |
| #46 | Luna-D/Neutron boundary | `[~] claimed:luna-d` | source/contract audit complete; external app-facing uninstall capability absent. |
| #100 | Luna-D/Coordinator metadata | `[~] claimed:luna-d` | live GraphQL dependency audit complete; Coordinator must mutate native relationships/labels. |

No queue item is silently treated as done. Unclaimed A/C items above are explicit handoffs, not D claims; lane protocol forbids D from claiming another lane's item. Coordinator must use `todoctl claim A luna-a 78`, `todoctl claim A luna-a 82`, `todoctl claim C luna-c 79`, and `todoctl claim C luna-c 83` (or record an explicit changed owner) to reach zero unexplained queue entries. #38 requires a backend owner reassignment rather than a fabricated Plasmon lane claim.
