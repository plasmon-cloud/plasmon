# Plasmon 0.1.0 internal r2 TDD queue

This file is the shared queue for Luna Medium TDD agents preparing red gates for internal release `release/0.1.0-r2` on the path to the public Plasmon `0.1.0` release.

## Status

- `[ ]` unclaimed
- `[~]` claimed / in progress / harness gap under investigation
- `[x]` red gate ready for implementor consumption

Claim work by changing exactly one `[ ]` to `[~]` before editing a gate. Finish only when the intended missing behavior is represented by an executable red gate and unrelated baseline behavior remains green.

If the current production/headless API cannot faithfully express the user action, KEEP the item `[~]` and append `HARNESS GAP:` with the exact missing production/test seam. Do not fake React/DOM behavior in the headless harness and do not implement product behavior from the Luna TDD role.

Red gates belong under `apps/plasmon/test/tdd/.red/` as `issue-<N>.red.test.ts`. The hidden `.red` directory keeps them out of Bun's ordinary recursive discovery on this staging branch. Run one gate explicitly with:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-<N>.red.test.ts
```

When an implementor takes an Issue, the gate is copied/adopted onto that Issue branch as a normal production regression and must become green before merge.

This `planning/release-0.1.0-r2-tdd` branch is staging only. It is not the `release/0.1.0-r2` integration branch and must never be merged wholesale while gates are intentionally red.

## Lane A — Desktop / FileManager / Filesystem interaction

- [ ] #44 — Create Shortcut through the canonical shortcut primitive
- [ ] #51 — Send to Desktop shortcut command
- [ ] #65 — Import/paste operation progress state
- [ ] #66 — Drag preview above window stack
- [ ] #86 — Mouse-selectable FileManager diagnostic text
- [x] #92 — Multi-item drag-move progress state — TDD:RTL RED
- [ ] #93 — Preserve image thumbnail aspect ratio
- [ ] #94 — Bounded video thumbnails
- [ ] #110 — Filesystem-backed Show Hidden Files preference
- [ ] #115 — Shared thin resource-command layer

## Lane B — Shell / Windowing / global desktop interaction

- [ ] #61 — Headless Shell overlay controller
- [ ] #63 — Alt-Tab window switcher
- [ ] #72 — Coherent taskbar presentation state
- [ ] #87 — Start default System-folder retirement regression
- [ ] #91 — Distinguish search result caps from safety truncation
- [ ] #109 — Shared pin/unpin presentation
- [ ] #111 — Shell visual-system convergence
- [ ] #117 — Persist native window placement
- [ ] #118 — Group multiple native app instances in taskbar
- [ ] #119 — Native dialog/transient-window ownership semantics

## Lane C — Native Apps / Editors / Games / Media

- [ ] #38 — Sharing provider/storage reconciliation regression surface
- [ ] #58 — Standalone Review.neutron Atom MVP regression surface
- [ ] #64 — Filesystem-backed js-dos progress persistence
- [ ] #89 — Monaco workers under canonical Program Files path
- [ ] #96 — Packaged native application identity assets
- [ ] #112 — Shared first-party native-app chrome
- [ ] #113 — Text Monaco desktop-editor parity
- [ ] #114 — Markdown formatter and Monaco command affordances
- [ ] #123 — Game resource artwork through shared presentation
- [ ] #124 — Screenshot thumbnails for persisted game saves

## Lane D — Cross-surface / harness adequacy

Lane D does not duplicate feature implementation. It prepares composed red gates and audits whether the headless interaction vocabulary is sufficient.

- [~] #78 — Shortcut lifecycle across creation/open surfaces — WAIT FOR #51 integration
- [ ] #79 — Native document close lifecycle across Process/Windowing
- [ ] #81 — Taskbar lifecycle across Shell/Process/Windowing
- [x] #82 — Filesystem bootstrap across managed roots — TDD:ALREADY GREEN
- [ ] #83 — Runtime selection across js-dos and EmulatorJS
- [ ] #107 — Integrated packaged baseline: identify deterministic journeys that should move below Playwright
- [ ] #25 — Prove active OS no longer depends on legacy gui2 before removal
- [ ] #26 — Prove active OS no longer depends on legacy src/platform compatibility layer
- [ ] #46 — Neutron uninstall capability boundary: define testable Plasmon contract or explicit missing capability
- [ ] #100 — Dependency metadata audit as a release-queue correctness gate

## Harness-gap queue

Luna agents append concise entries here whenever an Issue cannot be faithfully expressed through production/headless seams.

Format:

`- Issue #N — HARNESS GAP: <missing action/controller/inspection seam>; desired vocabulary: <example>`

Do not resolve gaps from the Luna TDD role. A ChatGPT implementor/harness owner will repair the production/test seam, after which the claiming Luna agent resumes the red gate.
