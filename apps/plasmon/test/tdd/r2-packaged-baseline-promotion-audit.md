# #107 integrated packaged baseline deep audit

Snapshot: current integrated package/test topology inspected at `origin/release/0.1.0-r2` (`f4ac3b4c`). No browser session was available locally; this records executable adoption paths and distinguishes existing CI evidence from a fresh run.

## Packaged journeys and truthful layer

| baseline journey | current lower guard | packaged/browser proof | #107 disposition |
|---|---|---|---|
| boot installed Plasmon tile, registry, `/app/plasmon` asset paths | `demoEnvironmentHarness`, refactor guards | `plasmon-refactor-smoke.spec.ts`, smoke CI | packaged proof exists; fresh run pending |
| Desktop/FileManager open, rename, selected-label geometry | FileManager/label/activation tests | `plasmon-golden-path.spec.ts` and refactor smoke | lower + packaged; #95/#191 remain separate |
| `.sys` and `.neutron` activation | `refactorGuards`, `resourceOpenCrossSurface`, Review installed integration | refactor smoke and Review demo | canonical dispatch lower guard is durable; browser proof exists in CI topology |
| Delete → Recycle Bin → restore/empty | `fileManagerDelete`, `trashLifecycle`, RecycleBin model | golden path opens Recycle Bin; no complete packaged delete/restore assertion found | **missing packaged journey**; retain lower guard |
| Download, collision naming, rename, folder-drop | FileManager final/polish/gate3 tests | golden path exercises rename/navigation; does not prove all listed actions | **lower proof exists; packaged acceptance partial** |
| Start/Search click-away, filesystem results, app presentation, pinning/inventory | shell gate3/projection/taskbar/RTL tests | refactor smoke and golden path | lower guard durable; exact future #193/#194 geometry pending |
| taskbar lifecycle after process/window close | Process/Window/taskbar model tests; #81 packet now B-owned | golden path close flow, smoke task menu | composed #81 regression not yet integrated |
| Text/Markdown Monaco open/edit/save/reopen | document/association/Monaco adapter tests | `plasmon-monaco-packaged.spec.ts`, golden path | packaged specialist exists; #67/#89/#200 worker/path acceptance remains |
| Photos fullscreen fallback / Video unsupported codec | Photos fullscreen/media tests, video capability tests | no dedicated packaged Photos/Video spec in configured specialist list | **browser/manual gap**; #180 and media acceptance remain |
| Program Files/runtime presentation | Program Files/runtime tests | js-dos/demo and EmulatorJS proof specs; Monaco worker check in specialist | js-dos/EmulatorJS browser paths exist; canonical Monaco Program Files path #89 not integrated |
| explicit js-dos fixture/game launch | `src/games/demoFixture.test.ts`, runtime tests | `plasmon-demo-game.spec.ts`, `plasmon-games-proof.spec.ts` | packaged proof exists; no boot-time Doom seed is required |
| EmulatorJS local assets | emulator runtime tests | `plasmon-emulatorjs-proof.spec.ts` | packaged proof exists; runtime selection #83 lower gate pending |
| Review independent install/open/basic workflow | Review integration and projection tests | `plasmon-review-demo.spec.ts` | packaged proof exists via PR #206 / CI topology |
| browser health | `browserHealthHarness.test.ts` | shared health in refactor smoke and specialist specs | policy durable; #190/#67/#200/#202/#175 allowances/defects remain |

## Specialist acceptance inventory

`package.json` runs smoke with refactor smoke and #192 placement; specialist with golden path, Monaco packaged, Review demo, EmulatorJS proof, and demo game. It does **not** run the separately named `plasmon-games-proof.spec.ts`, `plasmon-persistence.spec.ts`, #190 presentation spec, #191 FileEntry spec, #175 geometry spec, or future A browser RED files. Persistence has its own workflow. The browser CI therefore exists, but it is not a universal #107 baseline runner.

## Promotion conclusions

- Do not count source inspection, `--list`, or the fast suite as packaged acceptance.
- The permanent lower-layer destinations are already strong for deterministic open, identity, Trash, classification, Process/Window, and runtime routing.
- Remaining #107 evidence is a packaged/manual rerun report, not a new broad browser mega-test. Add narrow specs only for the listed missing Photos/Video and Delete/restore packaged claims if product owners require automation; otherwise record manual evidence.
- **Disposition: BROWSER SPEC ONLY / CLOSURE AUDIT COMPLETE FOR LOWER LAYERS.** Exact remaining work is a real packaged run and explicit report of each baseline row, with no unrelated Issue closure.
