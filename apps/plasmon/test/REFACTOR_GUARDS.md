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
| installed packages/assets -> browser runtime | `.neutron` archives + canonical provisioning + installed HTTP paths | Kernel-hosted Plasmon/Review/runtimes/workers | `plasmon-refactor-smoke.spec.ts`: real boot, packaged editor, Review package, authored js-dos fixture and first-party request health |
| browser runtime -> health gate | browser error/request/response signals | packaged Playwright lanes | `plasmon-browser-health.ts`: unexpected warning/error/pageerror/first-party failed request/HTTP >=400 is fatal unless a narrow scenario-owned allow rule documents an already-owned defect or browser diagnostic |
| Window/Shell gross geometry -> usable viewport | Windowing/Shell semantics rendered by browser | user interaction | packaged refactor smoke: Search popup, native window controls, taskbar menu and Desktop rename remain reachable using tolerant bounds rather than exact pixels; #175 owns exact Search-panel geometry |

## CI tiers

### Fast PR refactor guard

`npm --workspace neutron-plasmon test`

Runs production/headless contracts and the bounded RTL adapter on every Plasmon-relevant PR. It should remain a seconds-scale feedback loop and must not need Kernel packaging, PocketIC, or a browser.

### Packaged Browser Smoke

`npm run test:e2e:plasmon:smoke`

Runs one real installed common path in the manifest-driven #167 environment. The dedicated `Plasmon Packaged Smoke CI` status exists so a package/runtime refactor can fail early without waiting for specialist emulator/game/editor acceptance.

### Full packaged acceptance

`npm run test:e2e:plasmon:specialist`

Retains the deeper golden path, packaged Monaco persistence, Review persistence, EmulatorJS, and demo-game proofs. The full browser workflow runs this specialist command only; the dedicated smoke lane owns the common-path smoke so CI does not pay for it twice. `npm run test:e2e:plasmon` remains the local aggregate command that runs smoke followed by specialist acceptance.

## Visual-regression feasibility result

Issue #187 completed a bounded hosted-CI spike with four focused regions and then removed the one-time test/workflow rather than creating a permanent screenshot gate.

Using the fixed Nix/Chromium environment, animations disabled and caret hidden, both the initial Playwright attempt and its retry produced identical SHA-256 hashes for every region:

- Desktop resource state: `5d7ece66c84a980bbebb612533dc8c59f0462b325b7275dc330ad7d0a3171182`
- Desktop rename state: `9d3d2c3830e4859c4448304c314f3a475ae9d24f80e131dada7e4b6c2c4b64f3`
- Search results state: `6448e955484558f8197feee605cefecf5a234727d7eac8dba02e98dc4f5492f8`
- Native window state: `8a5c6b5cc02d8fdf0c4fe14e6fcfc0d89940b99107b2e6ae465d4c1f5a1fa5b2`

That demonstrates focused region screenshots can be deterministic in the current hosted environment. They are **not** a required r2 gate. The same spike surfaced active packaged-browser defects (#190 and the Kernel iframe warning), so adding owned image baselines now would add review/update cost while semantic and gross-geometry checks already protect the refactor contracts more robustly. A future visual-specific Issue may add a small owned baseline set after those browser-health defects are resolved and a product owner defines which visual states are design contracts.

## Known product defects surfaced by the smoke

The strict packaged smoke intentionally keeps unknown failures fatal while temporarily allowing only issue-linked current defects needed to keep this testing PR operational:

- #175 / #193: Search popup geometry; broad refactor smoke permits the currently observed small right-edge overflow while exact geometry remains product-owned.
- #190: packaged Plasmon icon URLs incorrectly resolve at Kernel root and can be ORB-blocked; only `/static/plasmon/icons/**` failed-request diagnostics are allowlisted.
- #67 / #200: packaged Monaco worker startup under the current sandbox/opaque origin; the smoke still requires the real packaged editor to reach ready state.
- #202: packaged js-dos storage bootstrap under the sandbox; the smoke still requires the real js-dos player and canvas to reach ready state.

Remove each temporary allow rule when its owner Issue lands. Do not broaden an allow rule to absorb a new failure signature.

## Refactor review rule

Before replacing a subsystem, identify every row where it is an authority or consumer. A refactor may move the implementation into different modules, a Worker, or a rewritten React tree. The corresponding smoke should remain valid because it asserts the authority boundary and user-observable result rather than the old implementation shape.
