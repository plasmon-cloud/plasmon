# Native-app multiwindow isolation corpus

| scenario | required invariant | evidence/current gap |
|---|---|---|
| Text A + Text B | distinct Process/Window/Session/Monaco models | Process + model-owner tests; packaged browser gap |
| Text + Markdown | shared host does not mix document text/preview | model tests; browser gap |
| Photos + Text | media state independent from document dirty state | Process isolation only; browser gap |
| Video + Text | codec/error does not close editor | Process isolation; browser gap |
| Browser + editor | iframe state does not own Plasmon process | Browser source/Process tests; browser gap |
| two same-handler resources | distinct targets/processes unless singleton policy | Process multi-instance test |
| close one/focus another/save one | no cross-window mutation; no taskbar grouping claim | B owns taskbar grouping; C app isolation gap |

This corpus intentionally does not claim #118 taskbar presentation. Permanent
headless tests should use real `createHeadlessPlasmonEnvironment()` and
production Process/Windowing; browser only adds Monaco/media/iframe mechanics.
