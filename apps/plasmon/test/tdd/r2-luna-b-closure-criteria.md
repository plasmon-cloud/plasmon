# Luna-B r2 closure criteria and current state

## Required states

| closeout condition | evidence |
|---|---|
| zero unclassified r2 Shell/Windowing/taskbar Issues | `r2-luna-b-r2-issue-inventory.md`; live search on 2026-08-13 found no additional eligible unowned issue beyond listed packets |
| #81 accounted for | Claimed in control queue as `luna-b` under Lane D for packet preparation; `issue-81.composed.red.test.ts` passes all three composed tests; Lane-D owns ordinary-discovery promotion |
| deterministic unmet criterion has executable RED | #63, #91, #117, #118, #177, #183, #184, #185 each has explicit runnable `.red` failure; #185 deterministic command portion is a genuine production seam gap documented in acceptance map |
| browser-only criterion adoption-ready | #43, #177, #183 instructions target existing Playwright specs and strict health/DOMRect assertions; no local browser claim made |
| already-green criteria have durable tests | #61/#72/#81/#87/#109/#119 acceptance maps identify exact existing or characterization paths; #81 promotion gap explicitly recorded |
| every valid RED has permanent destination | promotion ledger lists destination, implementation PR, promoted state, stronger guard and gap for every gate |
| no generic incomplete disposition | inventory uses explicit verified full/core, characterization, closure audit, browser spec, wait, active ownership, or invalid/dependency reasons; remaining core statuses have executable gates or documented ownership |

## Current blockers that are not B permission to stop

- #190 PR #211 is active; consume its integrated visual assets when it merges, do not rewrite its packet.
- #175/#174/#176 and future #193/#197/#198/#199 remain other-owner dependencies.
- Browser package execution was not claimed locally; adoption-ready specs are provided.
- #185 requires a public WindowManager Show Desktop command; tests must not fabricate it.

## Polling protocol

Before closeout, fetch `origin/release/0.1.0-r2`, inspect open PRs/reviews, compare the inventory to live Issue search, and rerun the deterministic gate set. If a dependency merges, update the downstream evidence and promotion ledger while preserving ownership fences.
