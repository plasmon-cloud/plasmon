# First-party native registry inventory

Derived from `createPlasmonServices()` -> `registerWave2Applications()`,
`contentAppDefinitions`, Explorer/Properties/RecycleBin definitions, and runtime
registrations. Runtime-only definitions are process hosts, not `.sys` apps.

| id | .sys projection | display/handler | icon source | associations | launch/window | input | states/persistence/close | browser/assets/tests | Issues |
|---|---|---|---|---|---|---|---|---|---|
| native:text | TextEditor.sys | Text Editor | generated `content-apps.ts` glyph | txt/source/wildcard | OpenService -> Process -> native window | UTF-8 FsNode | DocumentSession, dirty close, save; loading/ready/error | Monaco workers; package + document/Monaco tests | #67/#89/#113/#179/#200 |
| native:markdown | Markdown.sys | Markdown | generated glyph | md/markdown | same | UTF-8 Markdown FsNode | shared session, split preview, dirty close | Monaco/Marked/DOMPurify; render/package tests | #67/#114/#179/#200 |
| native:photos | Photos.sys | Photos | generated glyph | image ext/MIME | same | image FsNode bytes | object URL lease, zoom/pan/nav, fullscreen fallback | image browser APIs; media/fullscreen tests | #112/#180 |
| native:video | Video.sys | Video Player | generated glyph | video ext/MIME | same | local bytes, URL, `.url` | object URL, native decode/error; no durable app state | video element/iframe; helper tests | #94/#107 |
| native:browser | Browser.sys | Browser | generated glyph | `.url` | same | URL/Internet shortcut | URL state, iframe loading/error, external open | sandboxed iframe; URL tests | #176/#107 |
| native:settings | Settings.sys | Settings | generated glyph | none | singleton Process/window | no resource | FsService storage summary, injected Shell preference callbacks | RTL/source only; model tests | #112/#179 preference dependency |
| native:explorer | FileManager.sys | Files | `system:folder` shared asset | none | same | directory/FS | navigation/FileManager state; normal close | package + navigation/RTL tests | A-owned FileManager issues |
| native:properties | `.Properties.sys` | Properties | `system:properties` | none | same | NodeId resource | current metadata through PropertiesPanel | shared panel/association tests | A/#178/#190 |
| native:recycle-bin | RecycleBin.sys | Recycle Bin | `SYSTEM_ICON_ASSETS` | none | singleton | Trash entries | Trash service, restore/delete/empty, events | package + model/RTL | #45/#107 |
| runtime:js-dos | none | js-dos | inline runtime glyph | `.jsdos` | Process/window host | `.jsdos` FsNode bytes | player lifecycle, URL cleanup, storage defect | script/WASM/canvas/Worker | #64/#121/#202 |
| runtime:emulatorjs | none | EmulatorJS | inline runtime glyph | `.nes` | Process/window host | validated NES bytes | iframe/postMessage lifecycle, teardown | iframe/JS/WASM/canvas/audio | #48/#83 |

The `SYSTEM_APP_FILE_NAMES` table also contains Start/Search historical names,
but those are not registered in `registerWave2Applications()` as native app
loaders and must not be counted as actual current first-party applications.
Likewise runtime hosts must not be promoted into Start or `.sys` projections.
