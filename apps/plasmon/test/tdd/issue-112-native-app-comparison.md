# #112 native-app comparison

| app | header/title | command area | content | status/error/empty | repeated primitive | legitimate exception |
|---|---|---|---|---|---|---|
| Text | no content title header; process title | file toolbar | Monaco | footer + alerts | editor toolbar/status | Monaco |
| Markdown | same | mode/save toolbar | Monaco + preview | footer + alerts | editor toolbar/status | preview |
| Photos | toolbar | zoom/fullscreen | image viewport | notice/status/error | media toolbar/state | panzoom |
| Video | none/overlay help | native controls | video/iframe | loading/error | media state | browser controls |
| Browser | address toolbar | Go/external | foreign iframe | loading/error/empty | toolbar/state | sandbox iframe |
| Settings | heading | forms | cards | unavailable status | cards | settings |
| Explorer | navigation header | view toolbar | FileManager | alert/footer | toolbar/status | FileManager |
| Properties | panel | panel actions | metadata | alert | content panel | shared panel |
| Recycle Bin | app header | action toolbar | table | loading/empty/error | toolbar/state | Trash model |
| runtimes | runtime overlay | none/app-specific | canvas/iframe | status/alert | runtime state | third-party engine |
