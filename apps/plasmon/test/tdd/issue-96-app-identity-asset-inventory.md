# #96 application identity asset inventory

| app | current source | placeholder? | package asset | canonical metadata consumers | fallback/provenance | gate |
|---|---|---|---|---|---|---|
| Text | `content-apps.ts::icon("Text", "T")` | yes | no dedicated asset | handler/app -> Shell/OpenWith/Properties | inline data URI | RED |
| Markdown | glyph `M↓` | yes | no | same | inline | RED |
| Photos | glyph `▧` | yes | no | same | inline | RED |
| Video | glyph `▶` | yes | no | same | inline | RED |
| Browser | glyph `↗` | yes | no | same | inline | RED |
| Settings | glyph `⚙` | yes | no | same | inline | RED |
| Explorer | `system:folder` shared asset | no app-local package asset | public shared SVG | NativeApp metadata | shared fallback | characterize |
| Properties | `system:properties` | no app-local | public shared SVG | metadata consumers | shared fallback | characterize |
| Recycle Bin | `SYSTEM_ICON_ASSETS[recycle-bin]` | no | public shared SVG | metadata consumers | shared fallback | characterize |
| js-dos | inline `DOS` glyph | runtime-only | runtime identity | handler/task/runtime | inline | #202/#121 boundary |
| EmulatorJS | inline controller glyph | runtime-only | runtime identity | handler/task/runtime | inline | #48 boundary |

#96 owns replacing user-launchable glyph metadata with packaged offline identity
assets. #190 owns shared presentation/path consumption; no duplicate icon map
may be introduced. Accessibility labels remain semantic metadata, separate from
pixels.
