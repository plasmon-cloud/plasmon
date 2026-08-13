# Resource presentation consumer matrix

Presentation is resolved from canonical resource/application identity. Surface
components must not recreate MIME, suffix, shortcut, Neutron, or fallback maps.

| Resource state | Desktop | FileManager | Search | Start | taskbar | Properties | Open With | native app/window identity |
|---|---|---|---|---|---|---|---|---|
| folder | shared folder presentation | shared folder presentation | folder result presentation | filesystem shortcut/folder presentation | n/a | folder icon/type | directory/open policy | Explorer/native process if opened |
| ordinary file | shared file type/fallback | shared `resourceIconPresentationForFile` | result presentation from canonical classification | shortcut target presentation | n/a | shared icon/type | AssociationRegistry candidates | handler-selected process/window |
| native `.sys` | native app identity, no suffix glyph | native app shared presentation | one app projection, no Documents leak | canonical Start shortcut | native taskbar metadata | native app properties | system handler/open authority | registered native process/window |
| installed `.neutron` | Element/package icon metadata | projection presentation | one canonical projection/direct Element result | filesystem projection/shortcut | live Element/task entry | installed app metadata | Neutron/open authority | Kernel-owned tile/iframe, not fake native process |
| shortcut to native app | target native artwork + shortcut overlay | target identity + overlay | shortcut target/app category | target identity + overlay | pin/task policy | shortcut target identity | shortcut dispatcher | target native/Neutron authority |
| shortcut to ordinary file | target file artwork + overlay | target identity + overlay | target-aware app/document result | target identity + overlay | n/a | target path/type | target AssociationRegistry | target handler/window |
| image thumbnail | shared contained thumbnail | `MediaThumbnail` image | thumbnail/icon based on result policy | shared image presentation | app/task icon only | shared image thumbnail | image handlers | Photos owns full media view |
| video thumbnail | future bounded frame or fallback | future bounded frame or fallback | classification/presentation fallback or bounded frame | same shared result | app/task icon only | type/fallback | Video association | VideoPlayer owns playback, #94 owns preview boundary |
| missing icon | shared deterministic fallback | shared fallback | shared fallback/identity | shared fallback/identity | task fallback | shared fallback | handler icon fallback | native identity remains separate |
| failed icon | onError -> shared fallback | same | safe fallback, no request storm | same | same | same | no effect on handler matching | Neutron/asset owner reports failure |
| unknown resource | generic file fallback | generic file fallback | documents/unknown result | no invented app | n/a | Unknown | no fabricated handler | no native identity |

## Authority and Issue map

- Classification: #189/#178; Search native projection: #174.
- Shared resolved presentation/assets: #190/#52; installed Element icons:
  #171; video preview: #94.
- FileEntry geometry: #191/#95; Desktop placement: #192/#172.
- Start/Search surfaces: #194/#193; view strategies: #196/#173.
- Shortcut semantics: #44/#51; context ownership: #176.

Known current local maps should be removed only after their consumer migrates
and the shared seam has equivalent lower-layer evidence. This matrix does not
require every surface to render every resource state identically; it requires
identity and fallback decisions to remain canonical.
