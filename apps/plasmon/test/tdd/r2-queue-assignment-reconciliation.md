# r2 queue assignment reconciliation (live queue)

Refresh: 2026-08-13 21:07 -0400; current release `2b6984e`; #100 semantic RED committed at `4b6009a`.

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

No queue item is silently treated as done. Unclaimed A/C items above are explicit handoffs, not D claims; lane protocol forbids D from claiming another lane's item.

## Post-merge stale queue audit — 2026-08-14

The live queue has stale dispositions after release `82f176a6`:

- **stale `[x]` green/RED labels:** #51 and #65 are merged/promoted; #93 is deterministic-green with a browser remainder; #115 is not green because no shared command seam exists; #192 is merged/green at core plus packaged evidence; #195 is **not implemented** and must not remain ALREADY GREEN; #79 and #83 have no completed composed packet and must not remain ALREADY GREEN; #112 remains characterization-ready rather than ALREADY GREEN.
- **stale `[~]` claim:** #81's B ledger already records a stronger equivalent green lifecycle test; B/Coordinator should release it to `TDD:ALREADY GREEN` after verifying that evidence. Other `[~]` claims have documented active implementation or harness gaps and should remain claimed.
- **merged rows missing from queue:** #173, #189, #190, #191, and #212's #173 implementation must be represented in the master ledger even though the compact live queue predates those rows.

Unclaimed A/C items remain explicit handoffs, not D claims. Coordinator should use `todoctl claim A luna-a 78`, `todoctl claim A luna-a 82`, and assign #38 to Sharing/Backend rather than fabricating a Plasmon lane claim. #79/#83 are D-owned cross-surface items despite their native/runtime subject matter; their current `[x]` queue labels require correction before closure.
