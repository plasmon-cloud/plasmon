# Desktop/FileManager behavior coverage matrix

Status is against integrated release plus Luna staging packets. “Browser
blocked” means the gate exists but local packaged session is absent.

| Behavior | Domain authority | Pure/headless proof | RTL proof | Browser proof | Missing acceptance / Issue |
|---|---|---|---|---|---|
| create document/folder | FsService + create-import | `final-gate`, `polish` | renderPlasmon command wiring | golden path | no material gap |
| rename | FsService.rename + rename model | model/polish/component | renderPlasmon | #191 editor geometry | #191 integration/rerun |
| select | FileManager model NodeId | file-manager model | renderPlasmon | browser hit testing only | no material gap |
| multiselect/range | selection model | model tests | #51 selection adapter | #66 real group drag | #66 blocked |
| drag | drag model + browser pointer adapter | drag/final-gate | renderPlasmon partial | #66/#95 | #66/#95 blocked |
| drop | drop-target + FsService move | model validation | adapter characterization | #66 real destination | #66 blocked; #92 status waits #65 |
| copy | clipboard + FsService.copy | model/clipboard | keyboard adapter | none needed | no material gap |
| cut | clipboard + FsService.move | model/clipboard | keyboard adapter | none needed | no material gap |
| paste | clipboard collision helper | final/model | #65 running-state gate | optional manual | #65 implementation/integration |
| import | create-import + FsService writes | final-gate cleanup/chunks | repaired #65 packet | optional manual | #65 implementation/integration |
| Trash/delete | TrashService/resource policy | delete/trash lifecycle | renderPlasmon command | golden path optional | no material domain gap |
| restore | TrashService + #192 placement | desktopCore + #172 composed gate | none | #172 integrated browser adapter | exact integrated composed run |
| shortcut | canonical shortcut primitive | create-shortcut | #51 consumer RTL | discoverability manual | #51 Send Desktop command |
| Send to Desktop | FileManager consumer over shortcut primitive | #51 helper fence | #51 RED UI | manual optional | production command missing |
| Properties | FsService inspection + Properties | file-manager/property tests | renderPlasmon | golden path native window | no material gap |
| Open With | Association/OpenWith/OpenService | open-with suites | renderPlasmon | native dialog optional | no material gap |
| hidden files | filesystem preference/visibility | preferences tests + #182 bootstrap | Explorer adapter #182 | #110 | packaged blocked; #182 migration |
| Grid | shared FileManager model/presentation | common semantics | existing adapter | no dedicated geometry gate | #196 later |
| List | FileManager view/presentation | common semantics only | no final strategy | repaired #173 gate | current layout RED; #196 later |
| Details | metadata presentation | common semantics | existing adapter | #173 distinguishes geometry | #196 later |
| image thumbnails | thumbnail lease + Visual | polish/Visual lifecycle | component characterization | #93 portrait/landscape/square | browser blocked |
| video thumbnails | future bounded media seam | no truthful seam | none | policy only #94 | implementation required |
| context menu | surface event adapters + canonical commands | gate3 policy | renderPlasmon | #176 matrix | production policy seam |
| keyboard navigation | keyboard adapter + per-view layout | keyboard tests | existing adapter | #173 spatial gate | List strategy |
| refresh/recomposition | RefreshGate + FsEvents | model/refactor tests | #65 state interaction | #110 reload | operation races after #65 |

## Duplication guard

Common semantics are intentionally not duplicated per view. Grid/List/Details
consume the same NodeId selection, activation, rename, command, drag/drop and
presentation authorities; only layout/spatial keyboard behavior belongs to the
view-specific acceptance layer.
