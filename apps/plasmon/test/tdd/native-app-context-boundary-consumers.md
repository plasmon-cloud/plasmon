# Native-app context boundary consumers

| app | editable/specialized Plasmon UI | foreign content | expected context owner |
|---|---|---|---|
| Text | Monaco/editor toolbar/status | none | Plasmon app; #176 global arbitration |
| Markdown | Monaco + preview/formatter | none | Plasmon app |
| Photos | image controls/zoom | none | Plasmon app |
| Video | app shell/external action | YouTube/foreign iframe body | iframe owns foreign body; Plasmon shell owns surrounding UI |
| Browser | address/Go/external | sandboxed web iframe | foreign page owns own body; no global interception |
| Settings | forms/cards | none | Plasmon app |
| Explorer/Properties/Recycle Bin | commands/panels/table | none | Plasmon app/FileManager authority |
| js-dos | runtime canvas/input | third-party runtime | runtime host/canvas; close/window remains Plasmon |
| EmulatorJS | runtime iframe host | child engine | child runtime; parent only token messages |
| Review.neutron | Kernel sibling iframe | entire Review app | Kernel/Review owns app content; Plasmon must not create fake native process |

This is input to active #176, not a competing context-menu implementation.
