# Desktop/FileManager post-#189 consumer audit

Refresh: integrated release `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
Active implementation exclusions: #190/PR #211, #191/PR #204, #51/PR #210,
#65/PR #208. This is source inspection only; no active packet was modified.

| Finding | Production location | Consumer | Disposition | Why |
|---|---|---|---|---|
| canonical semantic classification | `os/fs/resourcePolicy.ts::classifyResource` | FileManager/Search/Desktop/managed FS | already migrated / preserve | integrated #189 authority |
| local image/video/source suffix sets | `os/file-manager/file-icons.ts` | FileManager icon kind | #178/#190 then #201 | visual eligibility may remain but semantic duplication must converge |
| image MIME suffix map | `os/file-manager/thumbnail.ts` | image byte/object URL loading | legitimate local thumbnail behavior / review #93 | decoder MIME and type inference differ |
| shared Visual ResourceIcon | `os/visual/primitives.tsx` | FileEntry | already migrated | #52/#190 seam; don't duplicate |
| shortcut target composition | `file-icons.ts` + shared `composeShortcutPresentation` | FileEntry | #190 active / preserve | target presentation must remain outside shortcut serialization |
| native app handler presentation map | `file-icons.ts::SHARED_NATIVE_PRESENTATION` | FileManager direct native projection | #190 active / #201 later | legitimate fallback until shared asset identity fully integrated |
| Search media suffix set | `os/shell/search.ts::MEDIA_EXTENSIONS` | Search category | #178/#193 | not FileManager authority but cross-surface duplicate |
| Shell Start fallback glyph strings | `os/shell/Shell.tsx` | Start/FileManager-adjacent presentation | #190 active / B-owned surface | do not alter active #190/B packets |
| `.sys` / `.neutron` semantic assumptions | `readSystemAppMetadata`, `readNeutronAppMetadata` | FileManager direct presentation | already canonical | suffix alone never promotes identity |
| shortcut `.url` suffix fallback | `file-icons.ts`, open dispatcher | ordinary compatibility | legitimate compatibility / #44/#31 | must not replace shared shortcut metadata |
| FileManager type labels | `FileEntry.tsx` subtitle helpers | rows/properties | #178 consumer convergence | use canonical effective metadata when exposed |
| thumbnail fallback | `ResourceIcon`/FileEntry | image/video icon fallback | #93/#94/#190 | media boundary, not semantic classification |
| Properties/Open With handler icons | `properties.tsx`/AssociationRegistry | dialogs | #47 closure / #190 presentation | association remains authority |
| Explorer Favorites/root inventory | `ExplorerApp.tsx` | FileManager navigation | #182 | not a classifier issue |
| Desktop positions | `Desktop.tsx` + `layout.ts` | FileManager desktop view | #192 integrated; #172 closure | controller/persisted adapter distinction required |

## Classification rules

- **Already migrated:** `classifyResource`, shared FsService/NodeId, shared
  shortcut metadata, AssociationRegistry/OpenService, Trash authority.
- **#178:** ordinary MIME/language/type derivation and downstream type labels.
- **#190 active:** shared Visual asset root/icon identity; do not modify PR #211
  or packet.
- **#171:** Neutron Element icon probing; not Plasmon-owned assets.
- **Separate Issue:** thumbnail decode (#93/#94), Explorer inventory (#182),
  List layout (#173), Desktop collision (#172), FileEntry pilot (#191).
- **#201 cleanup:** remove only after migration, import/reachability and
  permanent evidence prove superseded.
- **Legitimate local behavior:** media-specific decoder/thumbnail MIME support,
  shortcut compatibility parsing, association registration.
