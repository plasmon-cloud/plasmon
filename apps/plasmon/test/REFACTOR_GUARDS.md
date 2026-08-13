# Plasmon refactor-guard contracts

This inventory names the externally observable boundaries that must survive substantial Plasmon refactors. It complements focused subsystem tests; it does not freeze module layout, React component structure, private state, CSS classes, or intermediary call graphs.

A replacement implementation is compatible when the observable authority/consumer contract below remains true and the named smoke stays green.

| Boundary | Authority / source of truth | Representative consumer | Refactor guard |
|---|---|---|---|
| production composition -> bootstrapped filesystem | `createPlasmonServices` + filesystem core | Shell, Desktop, FileManager | `refactorGuards.test.ts`: assembled boot has one `/Desktop`, `/System`, `/Apps`, `/System/Start Menu`, one native Settings resource, one Review projection, and no projection error |
| Neutron installation -> `/Apps` projection | Kernel/`NeutronBridge` installation discovery; filesystem projection is derived | FileManager, Search | `refactorGuards.test.ts` + `reviewInstalledIntegration.test.ts`: duplicate discovery still creates one Review projection; projection does not become install authority |
| native app registry -> `.sys` resource | native application registry + filesystem bootstrap | Start, Search, canonical open | `refactorGuards.test.ts`: one `native:settings` definition and one `/System/Settings.sys` resource |
| filesystem resource -> association -> open | filesystem + `AssociationRegistry` + filesystem open dispatcher/OpenService | Desktop, FileManager, Start, Search | `refactorGuards.test.ts` + `resourceOpenCrossSurface.test.ts`: text, Markdown, runtime, native system resource, shortcuts and Neutron projection retain the same logical owners |
| Neutron projection -> Kernel-owned tile | filesystem open dispatcher -> `NeutronBridge` | Search/FileManager/Start | `refactorGuards.test.ts` + `reviewInstalledIntegration.test.ts`: Review produces one bridge activation and no fake Plasmon Process/Window |
| runtime resource -> runtime handler | association registry/OpenService + registered runtime host | Process/Windowing | `refactorGuards.test.ts` and specialist runtime tests: `.nes`/`.jsdos` remain resources handled by runtimes, never fabricated `.sys` apps |
| stable resource identity -> mutation lifecycle | filesystem `NodeId` | FileManager/Desktop/Trash/open | `refactorGuards.test.ts`: create -> rename -> move -> open -> Trash -> restore keeps the same NodeId |
| Trash lifecycle | filesystem-core `TrashService` | FileManager, Recycle Bin | compact refactor lifecycle plus deeper `trashLifecycle.test.ts`; UI never implements a second delete store |
| persistence -> independent production composition | filesystem repository + bootstrap/reconciliation | all OS surfaces | `refactorGuards.test.ts` + `managedRootBootstrap.test.ts`: resource bytes/location/NodeId and managed projection IDs survive reconstruction without duplicate managed resources |
| application activation -> Process -> Windowing | Process controller + Window manager | Shell/taskbar | `rtl/refactorGuardSmoke.test.tsx`: Search activation creates the native process/window, taskbar reflects focus/minimize/restore, close converges all three authorities |
| filesystem/native/Neutron state -> Search/Start | filesystem + native registry + Neutron discovery | Shell projections | deterministic projection tests plus RTL refactor smoke; Search/Start remain projections, not application databases |
| filesystem state -> Desktop/FileManager | filesystem service | both resource surfaces | existing cross-surface/open and RTL smoke coverage; both surfaces observe the same resource and delegate activation to canonical opening |
| installed packages/assets -> browser runtime | `.neutron` archives + canonical provisioning + installed HTTP paths | Kernel-hosted Plasmon/Review/runtimes/workers | `plasmon-refactor-smoke.spec.ts`: real boot, Monaco worker, Review package, authored js-dos fixture and first-party request health |
| browser runtime -> health gate | browser error/request/response signals | packaged Playwright lanes | `plasmon-browser-health.ts`: unexpected warning/error/pageerror/first-party failed request/HTTP >=400 is fatal unless an exact documented allow rule applies |
| Window/Shell gross geometry -> usable viewport | Windowing/Shell semantics rendered by browser | user interaction | packaged refactor smoke: Search popup, native window controls, taskbar menu and Desktop rename remain reachable using tolerant bounds rather than exact pixels |

## CI tiers

### Fast PR refactor guard

`npm --workspace neutron-plasmon test`

Runs production/headless contracts and the bounded RTL adapter on every Plasmon-relevant PR. It should remain a seconds-scale feedback loop and must not need Kernel packaging, PocketIC, or a browser.

### Packaged Browser Smoke

`npm run test:e2e:plasmon:smoke`

Runs one real installed common path in the manifest-driven #167 environment. The dedicated `Plasmon Packaged Smoke CI` status exists so a package/runtime refactor can fail early without waiting for specialist emulator/game/editor acceptance.

### Full packaged acceptance

`npm run test:e2e:plasmon:specialist`

Retains the deeper golden path, packaged Monaco persistence, Review persistence, EmulatorJS, and demo-game proofs. `npm run test:e2e:plasmon` runs smoke first and then these specialist scenarios for full acceptance.

## Visual-regression spike policy

Issue #187 evaluates a small set of region-focused screenshots in the same pinned Linux/Chromium packaged environment. The spike intentionally avoids a full-desktop golden-image system. The final recommendation must consider:

- repeated-capture stability with animations disabled and caret hidden;
- cross-run screenshot hashes on hosted CI;
- whether the region contains clocks, cursors, animation, runtime canvases, or other nondeterministic pixels;
- baseline ownership and review cost when intentional design changes occur;
- whether a semantic/geometry assertion already protects the contract more robustly.

Until that evidence is complete, visual snapshots are **not** a required r2 gate. Geometry and semantic browser-health checks remain the required refactor protections.

## Refactor review rule

Before replacing a subsystem, identify every row where it is an authority or consumer. A refactor may move the implementation into different modules, a Worker, or a rewritten React tree. The corresponding smoke should remain valid because it asserts the authority boundary and user-observable result rather than the old implementation shape.
