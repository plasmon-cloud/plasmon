# r2 final RED-gate dependency graph

Edges are current acceptance dependencies, not historical Issue prose.

| edge | kind | rationale / current state |
|---|---|---|
| #65 → #92 | HARD | multi-item move uses the same FileOperationState contract; #65 promotion gap blocks #92 |
| #169 → #194 | ACCEPTANCE | Start idempotent reconciliation is a prerequisite for the reconstructed Start surface |
| #174 + #190 + #175 → #193 | ACCEPTANCE | Search needs canonical `.sys`, presentation, and stable geometry; #175 remains browser-owned |
| #169 → #194; #174 → #194 | ACCEPTANCE | filesystem-backed Start depends on canonical inventory/projection |
| #191 → #195 | HARD | FileEntry pilot establishes the adapter/state seam for FileManager decomposition |
| #195 + #173 → #196 | ACCEPTANCE | view strategy work consumes decomposed FileManager rendering and List contract |
| #43 + #177 → #199 | BROWSER / ACCEPTANCE | native window adapter consumes snap/repeated placement authority |
| #183 + #117 + #118 → #198 | ACCEPTANCE | taskbar reconstruction consumes action, placement and grouping state |
| #89 + #67 + #113 → #200 | BROWSER | shared Monaco host requires worker/package/editor contracts |
| #121 → #202 | BROWSER | runtime fixture/package is the js-dos sandbox reproduction surface |
| #64 → #202 | BROWSER | persisted js-dos state is the runtime storage scenario |
| completed presentation migrations → #201 | CLEANUP | visual cleanup must follow consumers migrating to shared presentation |
| #187 → #190/#191 | BROWSER | strict health and common packaged baseline are prerequisites; allowances remain narrow |
| #167 → all RTL gates | HARD | shared harness is the canonical adapter composition |
| #186 → persistence claims | BROWSER | retained-profile proof must not be replaced by reinstall |

Removed stale claims: #121 is not a prerequisite for the ordinary #181 document/media fixture (only #121's game fixture is excluded); #89 is not a generic native-app fixture; #190 does not require unrelated #67/#200/#202 defects to disappear. Coordinator should use this graph rather than the historical queue's coarse ordering.
