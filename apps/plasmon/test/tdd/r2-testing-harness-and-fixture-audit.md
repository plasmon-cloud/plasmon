# Testing / harness closure and #181 fixture audit

## #167 shared harness

**Result: FULLY CLOSED for the integrated acceptance criteria.** `origin/release/0.1.0-r2` contains the production-backed `createHeadlessPlasmonEnvironment()` in `apps/plasmon/test/headlessEnvironment.ts`, `renderPlasmon()` in `apps/plasmon/test/renderPlasmon.tsx`, Happy DOM preload/setup, RTL/user-event tests, and `test/refactorGuards.test.ts`/`test/reviewInstalledIntegration.test.ts` using real `createPlasmonServices()` composition. `apps/plasmon/TESTING.md`, `apps/plasmon/test/AGENTS.md`, and `test/README.md` define the hierarchy, Playwright E boundary, and HARNESS GAP vocabulary. Fast CI and the manifest-driven packaged lane are present.

The harness is not a reason to move policy into React. Browser session absence is an operational browser block, not a HARNESS GAP. The local worktree has `local.ndeploy.json` but no independently verified packaged session was run in this audit.

## #181 acceptance mapping (D-owned; no fixture implementation staged)

| canonical criterion | desired gate | current disposition |
|---|---|---|
| explicit opt-in | `createHeadlessPlasmonEnvironment({ demoFixture: true })` or the accepted production bootstrap flag is exercised; default call remains fixture-free | **missing production seam/contract decision**; do not invent API |
| production filesystem/bootstrap authority | fixture nodes/resources are created by production bootstrap/FsService and have real NodeIds | headless harness can prove this once the explicit flag exists |
| redistribution-safe assets | authored text/document/image/media bytes resolve from repository/package-owned fixture assets | package test required; no staged #181 packet |
| normal unflagged absence | ordinary `createHeadlessPlasmonEnvironment()` has no #181 demo-only resources | existing normal-boot tests are adjacent, not #181 acceptance |
| representative Documents | normal Documents resource discoverable by FileManager/Search/native association | should be a headless composed gate |
| representative source/text | real source/text fixture opens through canonical Text/Markdown association | should be headless + packaged if asset transport is claimed |
| representative image/media | image/media fixture reaches Photos/video presentation through filesystem authority | headless model plus package/browser as appropriate |
| #121 game fixture excluded | game archive/demo flag remains owned by #121 | existing `src/games/demoFixture.test.ts` proves separation |
| #89 Program Files excluded | Monaco worker/runtime path remains #89/#67/#200 | existing package/runtime tests prove separate authority |
| discovery | fixture enabled → normal resources → Search/FileManager/native apps discover normally | packaged proof required for the full journey |

**Owner action:** Testing/Integration must first settle the explicit production bootstrap seam; Luna-D must then stage deterministic RED. No fixture product implementation was made here.
