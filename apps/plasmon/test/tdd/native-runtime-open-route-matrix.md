# Native/runtime open-route matrix

| resource | classifier/association | OpenService target | Process/window result | native/runtime |
|---|---|---|---|---|
| `.txt` | Text rule | nodeId | `native:text` | Text |
| `.md` | Markdown preferred | nodeId | `native:markdown` | Markdown |
| image | Photos rule | nodeId | `native:photos` | Photos |
| video | Video rule | nodeId | `native:video` | Video |
| `.url` | Browser/shortcut parser | nodeId or URL | `native:browser` | Browser |
| Text/Photos `.sys` | resource policy systemApp metadata | handlerId/nodeId | native process | first-party app |
| Review `.neutron` | Neutron projection | NeutronBridge openElement | Kernel-owned sibling tile | standalone Review |
| `.jsdos` | runtime js-dos rule | nodeId | `runtime:js-dos` | runtime host |
| `.nes` | runtime EmulatorJS rule | nodeId | `runtime:emulatorjs` | runtime host |
| shortcut to each | shortcut dispatcher dereference | canonical target | same handler/target identity | no FileManager policy |

Permanent headless evidence: desktopCore dispatch, association tests,
resourceOpenCrossSurface, emulatorJsRuntime, demo fixture tests, Review installed
integration. Missing specialist edges are rename/move/stale-resource and final
installed browser startup; no surface-specific bypass is accepted.
