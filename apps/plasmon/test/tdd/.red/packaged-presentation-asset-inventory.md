# Packaged presentation asset inventory

Inventory date: 2026-08-13. Expected installed Plasmon package root is
`/app/plasmon/`; current shared constants still use a root-absolute
`/static/plasmon` path, which is the tracked #190 defect.

| Authority/family | Source | Package destination | Expected installed URL | Current constructor | Health / owner |
|---|---|---|---|---|---|
| Plasmon file/system icons | `apps/plasmon/public/static/plasmon/icons/*.svg` + `src/os/visual/assets.ts` | `/app/plasmon/static/plasmon/icons/*.svg` | `/app/plasmon/static/plasmon/icons/*.svg` or package-relative equivalent | `/static/plasmon/icons/*.svg` | current packaged 404/ORB risk; #190 |
| Plasmon mark/wallpaper | `public/static/plasmon/{plasmon-mark,wallpaper}.svg` | `/app/plasmon/static/plasmon/...` | package-local installed path | `/static/plasmon/...` through constants | #190 |
| Neutron Element declared icon | Kernel/package descriptor and `icon-resolver.ts` | Element package-owned static path | Neutron app-origin URL resolved by bridge | resolver uses verified declared/compatibility origin forms | deterministic guards green; installed browser boundary #171 |
| Neutron Element fallback | `ExternalElement` identity / shared application fallback | no Plasmon asset required | canonical shared fallback or declared icon | `ResourceIcon`/Shell fallback | #171/#190 distinction |
| native app developer artwork | native definition `icon` / installed app metadata | native package/Element-owned path | owner-provided package URL | passed through `NativeAppIcon` | consumer green; package owner validates |
| Monaco engine CSS/workers | `monaco-editor` build entrypoints and merged CSS | `/app/plasmon/main.js`, `/app/plasmon/monaco-workers/*` | installed package paths | build-generated worker URL | #67/#200 worker diagnostics; not #190 icon authority |
| js-dos runtime | managed `/System/Program Files/js-dos` plus build mirror | package `runtime/jsdos/*` | `/app/plasmon/runtime/jsdos/*` | `JS_DOS_BROWSER_RUNTIME_ROOT` | runtime authority split protected by jsdos tests |
| EmulatorJS runtime | managed Program Files plus URL-safe package mirror | package `runtime/emulatorjs/data/*` and host | `/app/plasmon/runtime/emulatorjs/*` | `EMULATORJS_BROWSER_DATA_ROOT` | emulator tests/package boundary; not shared Visual |
| foreign/Browser content | Browser/Neutron app-owned | foreign app package/origin | foreign owner URL | iframe/Browser app authority | never rewrite as Plasmon presentation |

## Required #190 correction

The shared Plasmon constants must resolve relative to the installed application
mount or receive a package-base URL from composition. Do not “fix” this by
allowing `/static/plasmon` failures in the health harness. Existing temporary
allow rules are evidence annotations only and must be removed when the product
path is corrected.

## Non-conflation fence

#190 covers Plasmon-owned shared assets and presentation composition. #171 covers
installed Neutron Element metadata/resolution. Monaco workers, js-dos, and
EmulatorJS are runtime-specific package authorities with independent URL-safe
transport requirements. Foreign/iframe content is never a Plasmon asset root.
