# r2 active implementation PR promotion audit v2

Post-merge refresh: 2026-08-14 after `git fetch origin --prune`. Integrated release is `82f176a6`; #204/#208/#210/#211/#212 are merged and no longer active implementation fences.

| PR / Issue | current head/state | packet adopted | actual tests inspected | promotion verdict |
|---|---|---|---|---|
| #204 / #191 | merged `82f176a6`; all checks PASS | A `1e579bf` packet; superseded guards retired | release characterization/RTL + `test/e2e/plasmon-file-entry-191.spec.ts` | **PROMOTED**: packaged smoke/spec executed green; #95 geometry remains separate. |
| #208 / #65 | merged `2b6984e`; all checks PASS | repaired A packet `d522336` / repaired tree `8453df4` | release operation model/RTL tests | **PROMOTED**: operation state and FsService authority contract are release-owned; old one-file RED is quarantine provenance. |
| #210 / #51 | merged `f3459881`; all checks PASS | repaired A packet `d522336` / repaired lower packet | release helper/RTL tests | **PROMOTED**: canonical shortcut authority, NodeId identity, collision, stale target/Desktop and no source mutation are release-owned. |
| #211 / #190 | merged `c982d531`; all checks PASS | A `318966c` presentation/browser packet | release Visual test + `test/e2e/plasmon-presentation-assets.spec.ts` | **PROMOTED**: focused installed asset requests are green in merged CI; old-root `/static/...` allowance retirement remains pending. |

## Current CI/review evidence

- #204/#208/#210/#211/#212 exact merged PR checks all passed Kernel, Fast Bun, packaged smoke, and applicable specialist/persistence/Review checks. Current release ancestry confirms these implementations are no longer active.
- Merged PR smoke scripts now execute #173 List geometry, #190 installed asset requests, #191 FileEntry bounds, and #192 placement adapter. Their evidence is recorded in `r2-browser-spec-execution-ledger.md`.
- #190's focused asset spec is green, but `plasmon-refactor-smoke.spec.ts` still retains old-root icon allowances; this is allowance retirement work, not a failed promotion.
- #195 has no implementation PR and is the next implementor packet after #191.

## Post-merge rule

Merged PR status is not itself Issue closure: retain separate evidence for lower-layer promotion, packaged execution, allowances, and human/manual acceptance. Do not call #195 green from characterization tests.

## Required implementor handoff

- #65: **PROMOTION ACCEPTED** at exact head; no PR modification or RED staging required. The current model/adapter contract and CI are sufficient; future #92 must consume this `FileOperationState` vocabulary.
- #51: **PROMOTION ACCEPTED** at exact head; no PR modification or RED staging required. The current helper tests are the appropriate deterministic acceptance layer; no implementation-coupled source-shape assertion is required.
- #190: after merge, run focused packaged asset request spec against a real installed session and retire only `/static/plasmon/icons/**` allowances; do not retire unrelated #67/#200/#202/Kernel warnings.
- #191: after merge, verify ordinary tests and packaged bounds; preserve #95 as a separate selected-label contract.
