# Settings native-app acceptance matrix

| setting/surface | source of truth | default/read/write | recomposition/failure | issue/layer |
|---|---|---|---|---|
| storage summary | FsService traversal | read-only; unavailable status | fresh Fs graph; error text | model Bun/RTL |
| theme select | injected Shell callbacks | callback only when supplied | no Settings-owned persistence | #112/B-owned |
| taskbar mode | injected Shell callbacks | callback only when supplied | no Settings-owned persistence | B-owned |
| association defaults | AssociationRegistry/FsService | Settings only explains Open With | registry tests | no duplicate |
| backup | explicit unavailable feature | no write | truthful message | Sharing future |
| sharing | explicit unavailable feature | no write | truthful message | #38/#127 |
| autosave | not currently exposed by Settings | #179 policy unresolved | must not localStorage | #179/C |

No foreground `localStorage` is used by Settings. Existing test proves callback
seam avoids Shell import and storage summary uses FS. A visible Settings app
RTL acceptance would be useful but no separate canonical r2 Issue owns redesign.
