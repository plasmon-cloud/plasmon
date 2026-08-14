# r2 final RED-gate dependency graph

Post-merge refresh: 2026-08-14; integrated release `82f176a6`. Merged #51/#65/#173/#189/#190/#191/#192 edges are release prerequisites/evidence, not active promotion blockers.

Edges are current acceptance dependencies, not historical Issue prose.

| edge | kind | rationale / current state |
|---|---|---|
| #65 → #92 | HARD | merged #65 `FileOperationState` is now the required vocabulary; #92 waits for implementor consumption, not release ancestry |
| #169 → #194 | ACCEPTANCE | Start idempotent reconciliation is a prerequisite for the reconstructed Start surface |
| #174 + #190 + #175 → #193 | ACCEPTANCE | merged #190 supplies presentation; Search still needs #174 and browser-owned #175 geometry |
| #169 → #194; #174 → #194 | ACCEPTANCE | filesystem-backed Start depends on canonical inventory/projection |
| #191 → #195 | HARD | merged #191 FileEntry pilot establishes the adapter/state seam; #195 is the next missing implementation and remains unstarted |
| #195 + #173 → #196 | ACCEPTANCE | merged #173 supplies List contract; #196 still waits for unimplemented #195 decomposition |
| #43 + #177 → #199 | BROWSER / ACCEPTANCE | native window adapter consumes snap/repeated placement authority |
| #183 + #117 + #118 → #198 | ACCEPTANCE | taskbar reconstruction consumes action, placement and grouping state |
| #89 + #67 + #113 → #200 | BROWSER | shared Monaco host requires worker/package/editor contracts |
| #121 → #202 | BROWSER | runtime fixture/package is the js-dos sandbox reproduction surface |
| #64 → #202 | BROWSER | persisted js-dos state is the runtime storage scenario |
| completed presentation migrations → #201 | CLEANUP | visual cleanup must follow consumers migrating to shared presentation |
| #187 → #190/#191 | BROWSER | merged #190/#191 have green PR smoke/spec evidence; shared #187 allowances, especially old #190-root diagnostics, still require retirement verification |
| #167 → all RTL gates | HARD | shared harness is the canonical adapter composition |
| #186 → persistence claims | BROWSER | retained-profile proof must not be replaced by reinstall |

Removed stale claims: #121 is not a prerequisite for the ordinary #181 document/media fixture (only #121's game fixture is excluded); #89 is not a generic native-app fixture; #190 does not require unrelated #67/#200/#202 defects to disappear. Merged #173/#190/#191/#192 are no longer implementation blockers. Coordinator should use this graph rather than the historical queue's coarse ordering.
