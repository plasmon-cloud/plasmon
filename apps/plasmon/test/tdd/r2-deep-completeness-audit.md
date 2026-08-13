# r2 deep completeness audit — expanded universe

This document supersedes the **scope count** in the first checkpoint ledger without deleting that historical artifact. The previous 79 rows were the milestone + active queue inventory. A second authority pass added closed prerequisites, unmilestoned follow-ons that are explicitly consumed by r2 packets, and the closed #187/#167 tracking Issues.

**Expanded universe: 103 Issues.** The 79 checkpoint rows plus 24 dependency/implementation rows: #29, #30, #31, #32, #33, #40, #41, #42, #45, #48, #49, #52, #57, #62, #70, #77, #80, #88, #90, #108, #122, #125, #127, #188. #125/#127 are explicitly marked deferred-from-r2 rather than silently omitted. #56 is unrelated Kernel CI and excluded. No Issue in the expanded set is unclassified.

## Added rows and independent verdicts

| Issue | state / authority | actual evidence | disposition |
|---|---|---|---|
| #29 remove hackathon seed | open; Games/Testing | `src/index.tsx` no longer imports hackathon content; `demoFixture.test.ts` proves normal boot has no packaged demo game; removal commits `3e8db49`/`ae1aa3e` are release ancestors | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN |
| #30 shared headless environment | closed; Testing | `test/headlessEnvironment.ts`, production `createPlasmonServices`, deterministic environment tests | CLOSURE AUDIT COMPLETE |
| #31 FileManager canonical open | closed; FileManager/Filesystem | `fileManagerActivation`, `resourceOpenCrossSurface`, refactor guards; merged implementation ancestor | CLOSURE AUDIT COMPLETE |
| #32 Start/Search canonical open | closed; Shell/Filesystem | shell activation and cross-surface tests; merged implementation ancestor | CLOSURE AUDIT COMPLETE |
| #33 packaged Playwright lane | closed; Testing | package scripts, manifest-driven demo environment, smoke/specialist workflows | CLOSURE AUDIT COMPLETE; #107 still needs fresh review report |
| #40 FileManager Delete→Trash | closed; Filesystem | `fileManagerDelete.test.ts`, `trashLifecycle.test.ts`, protected-resource negative cases | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN |
| #41 close negotiation | closed; Process | `process.test.ts`, document close tests | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN |
| #42 dirty Text/Markdown close | closed; Native Apps | `documentClose.test.ts`, save/discard/cancel/deferred close assertions | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN |
| #45 Recycle Bin surface | open; Native Apps | registered `native:recycle-bin`, model tests for list/restore/permanent-delete/empty/invalidation; golden path launches and renders empty surface | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN; Issue open/closure mismatch |
| #48 EmulatorJS runtime | open; Games/runtime | association, runtime-only registry, package assets, EmulatorJS proof spec and CI topology | PACKAGED BROWSER SPEC ONLY; browser execution evidence required for closure |
| #49 `.neutron` Search classification | closed; Shell/Neutron | `search-projection.test.ts`, merged implementation | CLOSURE AUDIT COMPLETE |
| #52 FileManager shared icons | open; Visual/FileManager | current FileManager consumer tests use shared presentation; #190 active installed-asset path is prerequisite | WAIT FOR #190 INTEGRATION |
| #57 Program Files reconciliation | closed; Filesystem | `programFiles.test.ts`, runtime roots and package tests | CLOSURE AUDIT COMPLETE |
| #62 Window MRU history | closed; Windowing | `mru.test.ts` full focus/minimize/close history | CLOSURE AUDIT COMPLETE |
| #70 cross-surface open regression | closed; Testing | `resourceOpenCrossSurface.test.ts` and refactor guards | CLOSURE AUDIT COMPLETE |
| #77 Trash lifecycle backfill | closed; Testing/Filesystem | `trashLifecycle.test.ts` composes FileManager, Trash and Recycle Bin authorities | CLOSURE AUDIT COMPLETE |
| #80 Association/OpenService backfill | closed; Testing | `refactorGuards`, `fileManagerActivation`, association/open tests | CLOSURE AUDIT COMPLETE |
| #88 runtime-only Start inventory | open; Shell/Native Apps | `runtimeOnlyInventory.test.ts`, Start/Search runtime-only registry tests, docs | ALREADY GREEN — COMPLETE CORE ACCEPTANCE PROVEN; packaged visible inventory not freshly rerun |
| #90 Neutron Search presentation | open; Shell/Neutron | merged PR #162; `search-projection.test.ts` asserts title/application presentation/unknown state and no duplicate direct Element | ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN; GitHub open mismatch |
| #108 Explorer Back/history | open; FileManager | `src/native-apps/explorer/navigation.test.ts` proves model; packaged visible Back button spec is absent from configured specialist command | VERIFIED CORE RED / INCOMPLETE ACCEPTANCE |
| #122 daedalOS game UX audit | open; Games research | Issue requires direct reference inspection and parity-ledger evidence; no executable packet or integrated parity report found | CHARACTERIZATION READY |
| #125 MTN authorization adapter | open; Sharing/Security; later scope | body explicitly says deliberate release boundary and depends on #38/MTN; no r2 implementation target | DEFERRED FROM r2 — CANONICAL EVIDENCE |
| #127 live Review sharing | open; Review/MTN; later scope | body explicitly depends on #125 and deliberate release; no r2 implementation target | DEFERRED FROM r2 — CANONICAL EVIDENCE |
| #188 duplicate tracking Issue for #187 | closed; Testing | body is implementation handoff duplicate; PR #188 merged and closes #187 acceptance work | CLOSURE AUDIT COMPLETE / DUPLICATE |

## Scope corrections to checkpoint

- #45 is not merely “future native surface”: its implementation and deterministic/native packaged entry evidence are integrated. Only the Issue's GitHub state is stale.
- #48 is not only a future characterization: the runtime implementation and browser proof exist, but acceptance remains packaged/browser evidence rather than headless green.
- #88 and #90 are implemented and have strong ordinary tests; they remain open GitHub closure mismatches, not unowned REDs.
- #108 has a truthful lower model guard but still lacks its Issue-specific packaged Back-button proof.
- #38 remains Backend/Sharing Agent 9 ownership; it is not a Luna-C Plasmon UI issue.
- #58, #79, #83, and #89 are C deep-work handoffs. #81 is B-owned. #78/#82 are A-owned. #25/#26/#46/#100/#107 are D-owned.

## Complete-universe invariant

The checkpoint master ledger remains the detailed 79-row field ledger. This expanded document provides the added 24 rows and explicit cross-reference. Therefore the combined universe is **103 / 103 classified**, while GitHub state remains mostly open even where release ancestors and durable tests prove implementation. The program is not closed: active PR promotion, browser evidence, packet quarantine, and metadata reconciliation remain explicit blockers.
