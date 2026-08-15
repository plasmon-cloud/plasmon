# Luna-A r2 promotion audit

Audit source: `origin/release/0.1.0-r2` at
`56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.

This audit inspects the release worktree, merged PR history, permanent test
paths, and current open ownership. It does not modify product implementation or
any active implementation branch.

| Issue | Disposition | Final packet path | Intentional executable RED? | RED file(s) | Original RED proven against | Implementation PR/commit | Permanent regression path after implementation | Regression currently GREEN? | Merged into r2? | Promotion status |
|---|---|---|---|---|---|---|---|---|---|---|
| #44 | ALREADY GREEN | `.red/issue-44-closure-audit.md` | NO | none; `issue-44.red.md` is audit only | N/A — no valid corrective RED | PR #149 / `aaeb6b738ed3f7e5da6d4e987138c6f2e76f18d8` | `create-shortcut.test.tsx`, `desktopCore.test.ts`, refactor/open guards | YES; focused current release tests pass | YES | ALREADY GREEN |
| #51 | GREEN IN R2 | `.red/issue-51.red.md` | YES, historical RTL | `issue-51.red.ui.test.tsx`, `issue-51.red.test.ts` | Historical packet gate; exact execution SHA not retained in packet; staging ancestry `3467309d2199beff40ba60dc8e5bf7ebe2164b26` | PR #210 / `f3459881bbb1fb151ea71b17d7c0f8bb83f8a9c7` | `test/rtl/issue-51-send-to-desktop.test.tsx`, `send-to-desktop.test.ts`, shortcut guards | YES; current RTL and headless tests pass | YES | GREEN IN R2 |
| #65 | GREEN IN R2 | `.red/issue-65.red.md` | YES, historical RTL | `issue-65.red.ui.test.tsx` | Historical packet gate; exact execution SHA not retained; staging ancestry `3467309d2199beff40ba60dc8e5bf7ebe2164b26` | PR #208 / `2b6984e96647eae1f3abe5719d3a3782809ceeb9`; recovery PR #232 / `aebb255bb0605f945258d581acab96d1f905b4b0` | `test/rtl/issue-65-operation-progress.test.tsx`, operation-state/presentation tests | YES; 2 focused RTL tests pass (React act warnings only) | YES | GREEN IN R2 |
| #66 | BROWSER BOUNDARY | `.red/issue-66.red.md` | YES, browser-spec gate | `test/e2e/plasmon-drag-preview-66.red.spec.ts` | Exact execution SHA not recorded; packet says browser execution pending | none found | same Playwright spec; future promotion must retain real overlap/hit-test/drop/cleanup evidence | NOT EXECUTED | NO implementation found | RED NOT YET CONSUMED |
| #86 | BROWSER BOUNDARY | `.red/issue-86.red.md` | YES, browser-spec gate | `test/e2e/plasmon-diagnostic-selection-86.red.spec.ts` | Exact execution SHA not recorded; packet explicitly says browser boundary | none found | same Playwright selection/drag distinction spec | NOT EXECUTED | NO implementation found | RED NOT YET CONSUMED |
| #92 | GREEN IN R2 | `.red/issue-92.red.md` | YES, RTL | `.red/issue-92.red.ui.test.tsx` | `5a6c9bb3d46d536c60a41382d5e3754539753dcd` (delayed real move gate reproduced before PR #223) | PR #223 / `34e5daea6b59e66a7980a892df90a61729ffd7c5` | `test/rtl/issue-92.test.tsx`, `move-operation.test.ts`, operation-state/presentation tests | YES; 3 focused RTL tests pass | YES | GREEN IN R2 |
| #93 | CHARACTERIZATION ONLY | `.red/issue-93.red.md`, `.red/issue-93-browser-geometry-spec.md` | NO current deterministic RED | no executable RED; `test/e2e/plasmon-image-thumbnails-93.spec.ts` is browser acceptance | N/A — deterministic containment is green; browser run SHA not available | none found | Visual/thumbnail tests plus packaged `plasmon-image-thumbnails-93.spec.ts` | Deterministic YES; browser NOT EXECUTED | No implementation PR found | CHARACTERIZATION ONLY |
| #94 | DEFERRED | `.red/issue-94.red.md`, eligibility/lifecycle contracts | NO — packet explicitly rejects a fake Bun RED | none | N/A — missing production media-thumbnail seam | none found | future bounded video probe/lease tests plus browser codec/seek gate | NO executable regression yet | NO | DEFERRED |
| #110 | GREEN IN R2 | `.red/issue-110.red.md`, packaged persistence contract | NO current deterministic RED | no corrective RED; `test/e2e/plasmon-hidden-preference-110.spec.ts` is browser acceptance | N/A — headless behavior already green | PR #151 / `ae3e290200b80cab877ab0d35a6fe24c3fce07d7` | `preferences.test.ts`, visibility tests, packaged hidden-preference spec | Headless YES; browser NOT EXECUTED | YES | GREEN IN R2 / browser boundary pending |
| #115 | CHARACTERIZATION ONLY | `.red/issue-115.red.md` | NO valid implementation-independent RED | none | N/A — source-shape/shared-seam assertion would be invalid | none found | existing open/Trash/clipboard/shortcut/refactor guards; future two-consumer seam tests if implemented | Existing outcomes YES; seam acceptance not proven | NO | NO VALID CORRECTIVE RED |
| #192 | GREEN IN R2 | `.red/issue-192.red.md` | YES, historical Bun | `issue-192.red.test.ts` | Historical gate staged from `3467309d2199beff40ba60dc8e5bf7ebe2164b26`; original run evidence is archived in packet history | PR #205 / `51cd761c207573a59197d53c9e2884335f2e7cc7` | `src/os/desktop/issue-192.test.ts`, `layout.test.ts`, composed #172 guards | YES; current release focused placement tests pass | YES | GREEN IN R2 |
| #195 | GREEN IN R2 | `.red/issue-195-final-packet.md` | NO valid structural RED; characterization only | `.red/issue-195.red.test.ts` | Characterization was staged from historical TDD base; no corrective RED claimed | PR #213 / `3d7042b2102a5df51145a1965cf347430fde91b1` | `issue-195.characterization.test.ts`, render-state/FileEntry/adapter guards; #196 strategy guards | YES; current release focused guard set passes | YES | GREEN IN R2 |

## Current implementation train outside the Lane-A queue

- **#176 — GREEN IN OPEN PR:** PR #235 (`agent/issue-176-context-menu-boundary`)
  explicitly consumes this lane's packet at `7a69d9b` and adds permanent Bun/RTL
  and Playwright paths: `context-menu-boundary.test.ts`,
  `test/rtl/issue-176.test.tsx`, and `test/e2e/plasmon-context-menu-176.spec.ts`.
  Do not modify the active branch.
- #193 remains open PR #219; #174 is open PR #259. They are cross-lane Shell
  ownership and are not duplicated here.

## Evidence notes

Current release focused execution:

```text
#92 RTL: 3 passed, 0 failed
#51/#65/#196 RTL: 4 passed, 0 failed, 40 expects total
#195/#192/#51/#65/#FileManager guards: 27 passed, 0 failed, 75 expects
#44/#110/FileManager guards: 35 passed, 0 failed, 102 expects across runs
```

The browser environment/session was not executed in this audit. Missing or
stale packaged session state is an operational browser block, not a product
RED. Historical browser RED specifications without a permanent implementation
regression remain explicitly **RED NOT YET CONSUMED** rather than silently
promoted.

## STATUS

- Total Lane-A queue entries: **12**.
- GREEN IN R2: **#51, #65, #92, #110 (deterministic), #192, #195**.
- GREEN IN OPEN PR: **none in the Lane-A queue**; #176 is outside the queue and
  is GREEN IN OPEN PR #235.
- RED NOT YET CONSUMED: **#66, #86**.
- CLAIMED / IN PROGRESS: **0** in Lane A.
- ALREADY GREEN / CHARACTERIZATION: **#44, #93, #115**.
- HARNESS GAP / DEFERRED: **#94 deferred; no Luna-A harness gap**.
- Current exact release SHA audited: `56752dc3e0fdb21c8c2d13e174c1836d73e6dde8`.
- Current Issue being worked: **promotion audit and #66/#86 browser RED
  consumption evidence**.
- Next executable Issue: **#66** packaged drag-preview adoption, once a matching
  browser session is authorized; do not claim parser/list output as execution.
