# Program Files runtime authority inventory

| runtime | logical FS resource | current package mirror | owning app | installation authority? | bootstrap/idempotence | tests |
|---|---|---|---|---|---|---|
| js-dos | `/System/Program Files/js-dos` | `./runtime/jsdos/` | js-dos host | no; curated resource | `reconcileProgramFilesRuntimeDirectory`, package build | programFiles/jsdos/package |
| EmulatorJS | `/System/Program Files/EmulatorJS` | `./runtime/emulatorjs/data/` | EmulatorJS host | no | build assets + managed root seam | package/emulator tests |
| MonacoEditor | expected `/System/Program Files/MonacoEditor` | current top-level `./monaco-workers/` | Text/Markdown | no | managed root test only; executable migration absent | #89 RED |

Program Files is protected filesystem exposure, not Neutron installation
authority. `/Apps/*.neutron` remains Kernel projection. Runtime mirrors are
browser transport only where URL serving requires them; they cannot become a
second runtime catalog or `.sys` application.
