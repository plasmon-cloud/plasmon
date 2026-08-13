# Canonical resource classification truth table (planning artifact)

This table is an executable-spec planning matrix, not production authority. The
classifier must own derived type/category/language vocabulary while FsService
owns persisted facts and AssociationRegistry owns opening.

| Representative resource | Persisted facts | Canonical derived class | MIME | Search category | Properties type | Editor hint | Presentation input | Association input | Owner/status |
|---|---|---|---|---|---|---|---|---|---|
| folder | kind=directory, name | directory | none | documents | Folder | none | folder | directory/open policy | FsService/classifier PRESERVE |
| plain text | file, `.txt`, optional text/plain | ordinary text | text/plain | documents | Plain text | plaintext | text/file | explicit MIME + extension | classifier #178 CHANGE |
| Markdown | file, `.md` | Markdown | text/markdown when explicit/derived | documents | Markdown | markdown | text/markdown | AssociationRegistry | classifier #178 CHANGE |
| JavaScript | file, `.js` | source text | text/javascript or safe text | documents | JavaScript | javascript | text/source | AssociationRegistry | classifier #178 CHANGE |
| TypeScript | file, `.ts` | source text | text/typescript or safe text | documents | TypeScript | typescript | text/source | AssociationRegistry | classifier #178 CHANGE |
| JSON | file, `.json` | structured source | application/json | documents | JSON | json | text/source | AssociationRegistry | classifier #178 CHANGE |
| HTML | file, `.html` | markup | text/html | documents | HTML | html | text/source | AssociationRegistry | classifier #178 CHANGE |
| CSS | file, `.css` | stylesheet | text/css | documents | CSS | css | text/source | AssociationRegistry | classifier #178 CHANGE |
| PNG/JPEG/GIF/WebP | file, image suffix/MIME | image | image/* | media | Image | none | image thumbnail | Photos/AssociationRegistry | #178/#93 PRESERVE + CHANGE precedence |
| audio | file, audio MIME/suffix | audio | audio/* | media | Audio | none | audio/file fallback | Video/audio association | #178 CHANGE |
| video | file, video MIME/suffix | video | video/* | media | Video | none | video thumbnail/player | Video association | #94 policy UNKNOWN |
| native `.sys` | file, system MIME + metadata | system-app | application/x-plasmon-system-app | apps | Native application | none | native app identity | system handler/open dispatcher | #174/#189 CHANGE |
| installed `.neutron` | file, Neutron MIME + metadata | neutron-app | application/x-plasmon-neutron-app | apps | Installed application | none | Element/package identity | Neutron/open dispatcher | #174/#189 PRESERVE |
| shortcut | kind=shortcut + target metadata | shortcut | shortcut format | apps/documents by target policy | Shortcut | target hint | target presentation + overlay | shortcut dispatcher | #44/#190 PRESERVE |
| unknown binary | file, unknown MIME/suffix | ordinary unknown | application/octet-stream or none | documents | Unknown file | plaintext only if safe | generic file fallback | AssociationRegistry candidates | #178 UNKNOWN |
| unknown text-like | file, no trusted MIME, safe text hint | ordinary text-like | safe text fallback | documents | Text/document | plaintext | text/file | AssociationRegistry | #178 UNKNOWN |
| conflicting extension + explicit MIME | file `.png`, explicit text/plain | explicit MIME class | text/plain | documents | Plain text | plaintext | text presentation | AssociationRegistry explicit MIME rules | #178 RED current |

## Precedence fence

Persisted resource facts and authoritative metadata are preserved. Explicit MIME
must not be overwritten by suffix guesses. Suffix inference is used only when
stronger metadata is absent. Unknown values fail safely and do not invent a
handler or native application. Rename may change derived classification only when
MIME/type was not explicitly pinned; NodeId never changes.
