# Luna-B r2 Shell / Windowing runway

**Authority baseline:** current `origin/release/0.1.0-r2` (`82f176a`). This is a TDD/specification runway only; no production implementation is included.

Every B-owned issue has one final disposition below. A RED destination is permanent production-model/RTL/browser coverage, not a source-shape assertion.

## Final B-owned dispositions

| Issue | final disposition | permanent guard / adoption destination | authority and handoff |
|---|---|---|---|
| #43 | **FINAL IMPLEMENTOR PACKET READY** | existing WindowManager snap tests; `issue-43-browser-adoption.md` adopted into packaged golden path | WindowManager owns snap/restore; browser adapter proves pointer continuity |
| #61 | **BLOCKED — #197 Shell decomposition owns the controller seam** | existing `issue-61.characterization.ui.test.tsx`; future overlay-controller Bun tests under #197 | Shell behavior is characterized; no standalone structural RED or duplicate controller |
| #63 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-63.red.ui.test.tsx`; future `src/os/shell/altTab.test.ts` plus packaged keyboard adoption | WindowManager MRU/focus remains authoritative; Shell is adapter |
| #72 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | `src/os/shell/taskbarPresentation.test.ts`, `shell.test.ts`, RTL taskbar journey | accepted pinned/running/active/launching/uncertain projection is green |
| #81 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | `apps/plasmon/test/taskbarLifecycle.test.ts` | real Process/WindowManager composition is green; no lifecycle shadow |
| #87 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Start reconciliation and `gate3.test.ts` suites | filesystem-backed Start retirement is green |
| #90 | **BLOCKED — #174 canonical `.sys` Search source-of-truth** | consume #174 packet; no duplicate Search inventory | not B-owned while #174 implementation is active |
| #91 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-91.red.test.ts` → permanent Search model tests; Shell warning RTL only if adapter changes | Search model owns cap/safety distinction; latest-result controller is preserved |
| #109 | **COMPLETE / NO IMPLEMENTATION REQUIRED** | Visual component tests plus Shell characterization | shared PinIcon and persistence are green; #190 is integrated |
| #111 | **BLOCKED — #201 visual-token cleanup and packaged/manual review** | current Visual/Shell component tests; #201 cleanup guards; bounded packaged/manual review | no honest CSS/source RED; claim released |
| #117 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-117.red.test.ts` → Windowing placement-persistence tests + packaged reopen proof | durable geometry belongs to Windowing/Fs composition, never Shell |
| #118 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-118.red.test.ts` → permanent grouping/member chooser model + RTL | ProcessId/WindowId remain member identities; no taskbar DB |
| #119 | **DEFERRED — no demonstrated native transient consumer in r2** | app-local prompt `issue-119.characterization.test.tsx` and `documentClose.test.ts`; future transient contract only after consumer selection | current app-local overlay and Process close semantics are complete; no owner API invented |
| #177 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-177.red.test.ts` → WindowManager placement policy; `issue-177-browser-adoption.md` | default placement/wrap is WindowManager-owned; browser proves reachability |
| #183 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-183.red.ui.test.tsx`, `.red/issue-183.red.alignment.ui.test.tsx`, `issue-183-browser-adoption.md` | Close delegates Process; alignment authority must be defined; menu geometry is browser-owned |
| #184 | **FINAL IMPLEMENTOR PACKET READY** | `.red/issue-184.red.test.ts`, `.red/issue-184.red.ui.test.tsx` → TaskManager resource/model/RTL tests | serialize resource identity with #174; Process/Windowing projection remains canonical |
| #185 | **BLOCKED — missing public WindowManager/Shell Show Desktop command seam** | existing `.red/issue-185.red.headless.test.ts` and `.red/issue-185.red.ui.test.tsx` after command exists | do not implement test-local minimize/restore policy |
| #198 | **FINAL IMPLEMENTOR PACKET READY** | `issue-198-refactor-red-packet.md`; #72/#81 green guards plus #118/#183 REDs | Shell projection only; Process/WindowManager remain authorities |
| #199 | **FINAL IMPLEMENTOR PACKET READY** | `issue-199-refactor-red-packet.md`; #117/#177 REDs plus #43/#177 browser adoption | NativeWindow is a browser adapter over WindowManager; no second manager |

## Existing RED adoption ledger

| RED | permanent destination | required preservation |
|---|---|---|
| #63 | `src/os/shell/altTab.test.ts` + RTL/browser adapter | MRU, commit/cancel, minimized/closed exclusion, accessible switcher |
| #91 | `src/os/shell/search.test.ts` / Search model tests; bounded warning RTL | ordinary category/total caps are not safety incomplete; traversal truncation remains visible; cancellation/latest result unchanged |
| #117 | `src/os/windowing/placementPersistence.test.ts` + reconstruction/package proof | validated Fs-backed record, identity separation, safe fallback, snap/max policy |
| #118 | `src/os/shell/taskbarGrouping.test.ts` + member chooser RTL/browser if geometry requires | one application projection, exact ProcessId/WindowId member targeting, close-one/final-child and pin survival |
| #177 | `src/os/windowing/defaultPlacement.test.ts` + packaged DOMRect adoption | bounded wrap/restart, titlebar/control reachability, small viewport |
| #183 | taskbar command model/RTL + packaged menu geometry | Process close negotiation, alignment persistence owner, source-adjacent contained menu |

## Refactor overlap and serialization

| refactor | relationship to B runway | file/authority rule |
|---|---|---|
| #197 Shell decomposition | **serialize** with #61 and #198, and coordinate with #193/#194 | owns `Shell.tsx` composition/controller cutover; B packets provide behavior, not a parallel Shell root |
| #193 Search reconstruction | **serialize only for shared Shell JSX/state edits**; no semantic dependency for #198/#199 | owns Search surface and #175 geometry; consumes Search model, does not alter taskbar/window authorities |
| #194 Start reconstruction | **serialize only for shared Shell JSX/state edits** | owns Start surface/reconciliation rendering; does not own taskbar/process/window state |
| #112 native-app chrome | **parallel-safe with #198; coordinate outer/inner boundary with #199** | #112 owns inner content chrome; #199 owns outer NativeWindow chrome and interaction |
| #200 Monaco/native-app runtime | **parallel-safe with #198; public-contract coordination with #199 only** | #200 owns Monaco worker/editor host and document model boundaries; no WindowManager or NativeWindow policy |
| #190 shared presentation | integrated prerequisite | consume current Visual/resource seam; no old icon resolver or duplicate tokens |
| #187 refactor guard suite | required guardrail | use existing browser health/package environment; do not add a second harness |

### Parallel-safe areas

- test/specification/ledger work;
- Shell taskbar projection tests consuming Process/WindowManager snapshots;
- WindowManager pure geometry characterization;
- packaged browser adoption review that does not edit shared implementation files;
- #112 inner app chrome and #200 Monaco host work behind public Process/Windowing contracts.

### Serialize with other refactors

- `Shell.tsx` root/controller/surface cutovers: #197, then coordinate #193/#194 and #198;
- `NativeWindow.tsx`, `interaction.ts`, and outer chrome: #199 with any outer-window portion of #112;
- canonical `.sys` Search projection: #90/#174 before TaskManager/Search identity work in #184;
- visual token deletion/manual appearance: #111/#201 after #190 consumers are stable.

No B-owned Issue remains operationally claimed by the released #61/#111/#119 characterization work. #198/#199 are packet-ready and not claimed by this lane.
