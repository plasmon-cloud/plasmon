# #113 Text acceptance matrix

| journey | authority | observable contract | layer | evidence/disposition |
|---|---|---|---|---|
| open existing `.txt`/source | FS -> associations -> OpenService | correct Text target/name/identity | headless + package | headless composition exists; packaged Monaco still #67 |
| new document | FileManager command + FS | explicit name, stable NodeId, empty model | RTL/headless | current packaged journey exercises it |
| edit/selection/undo/redo | Monaco adapter/model | editing remains operational; selection and native commands | browser for Monaco; RTL semantics | worker proof missing |
| dirty | DocumentSession | edit sets dirty; no silent clear | Bun | covered; autosave policy #179 |
| explicit Save/Ctrl+S | DocumentSession | bytes change only on successful save; dirty clears then | Bun + RTL | current save path exists |
| save failure/conflict | FsService/session | alert/status; bytes preserved; dirty remains | Bun | existing session tests |
| close dirty | Process close handler | Save/Discard/Cancel negotiation; discard never saves | Bun + RTL/package | #41/#42 evidence; #179 must preserve |
| reopen | FS/OpenService + Monaco | exact bytes/content and identity return | package/browser | current packaged spec, but worker health incomplete |
| language/title | #178 classifier + Text | document-aware title and visible language | Bun/RTL/browser | title/language chrome criteria remain #113 RED |
| status/commands/minimap/find | Text UX + Monaco | discoverable controls, cursor/status, configured preview | RTL + packaged browser | current minimap disabled and no command menu: core RED |

Unspecified: Monaco version, component names, exact CSS, exact HTML. Do not
move FS/document authority into Text React. Autosave scenarios are referenced
to #179, not duplicated here. #178 and #200 are dependencies/owners, not
reimplemented by this packet.
