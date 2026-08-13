# Issue #178 — precedence and supported-format table

This is a contract table, not a claim that the missing ordinary-resource
classifier already exists. `Actual release result` records what the integrated
source can currently prove; `future expected result` is the narrow #178
behavior to test after the real API is added.

## Precedence

1. `FsNode.kind` and validated metadata identity win for directory, shortcut,
   atom, system-app, and Neutron-app semantics.
2. An explicit authoritative/pinned/imported MIME wins over filename guessing.
   Sentinel system/Neutron MIME values must retain their metadata semantics.
3. For an ordinary file with no authoritative MIME, canonical extension mapping
   derives a MIME/type hint.
4. A rename may change a derived hint, but must not erase an explicit MIME.
5. An unknown extension remains safely ordinary/unknown; it must not become an
   executable/system/Neutron resource.
6. Editor language maps the canonical derived type/MIME through one adapter;
   it never becomes association authority.

## Cases to stage after the accepted classifier API is consumable

| Input | Future derived MIME/type | editor hint | Search/Properties expectation | Current release evidence |
|---|---|---|---|---|
| directory | directory semantic kind; no file MIME | n/a | folder/document semantics | `classifyResource` green |
| `.txt` | `text/plain` | `plaintext` | document; Properties reports same canonical fact | create helper persists `text/plain`; general inference absent |
| `.md` | `text/markdown` | `markdown` | document | create helper and Text table disagree only when MIME absent |
| `.js` | `text/javascript` or accepted canonical JS MIME | `javascript` | document/source | Text table supports language; no shared MIME derivation |
| `.ts` | accepted TypeScript text MIME | `typescript` | document/source | Text table supports language; no shared MIME derivation |
| `.jsx` | accepted JSX/JavaScript MIME if classifier declares support | `javascript` | document/source | Text table supports `.jsx`; classifier support unproven |
| `.tsx` | accepted TSX/TypeScript MIME if classifier declares support | `typescript` | document/source | Text table supports `.tsx`; classifier support unproven |
| `.json` | `application/json` | `json` | document | existing create/association evidence uses `application/json`; no global ordinary inference |
| `.html`/`.htm` | `text/html` | `html` | document | Text table + content associations; no shared inference |
| `.css` | `text/css` | `css` | document | Text table + content associations; no shared inference |
| `.svg` | `image/svg+xml` (if accepted) | `xml` | media/image | Photos and Text/FileManager each have local knowledge |
| `.png` | `image/png` | no editor language | media/image | Photos/FileManager local tables |
| `.jpg`/`.jpeg` | `image/jpeg` | no editor language | media/image | Photos/FileManager local tables |
| `.gif` | `image/gif` | no editor language | media/image | Photos/FileManager local tables |
| `.webp` | `image/webp` | no editor language | media/image | Photos/FileManager local tables |
| supported audio | only formats declared by content associations/media consumers | no editor language | media | exact supported set must be read from registered rules, not invented |
| supported video | only formats declared by `video/media.ts` and associations | no editor language | media | `VIDEO_MIME` is local video helper; migration ownership must be explicit |
| `.sys` | never system-app by suffix; only validated metadata + sentinel MIME | plaintext only if opened as ordinary text | Search projection only from validated system metadata | current Search packet covers native/raw projection defect |
| `.neutron` | never Neutron-app by suffix; only validated metadata + sentinel MIME | ordinary fallback | Search projection only from validated metadata | current `readNeutronAppMetadata` requires sentinel MIME |
| shortcut | shortcut semantic kind and target metadata | n/a | app category only when target/search policy says so | `parseStartShortcut`, activation tests green |
| extensionless text | explicit MIME wins; otherwise safe unknown/plaintext editor fallback | `plaintext` | document if canonical classifier says ordinary text | current editor fallback is plaintext |
| unknown extension | unknown ordinary file | `plaintext` | document/unknown, never executable | current FileManager has suffix fallbacks |
| unknown binary | explicit binary MIME if authoritative, otherwise unknown | plaintext/no language | safe document/unknown; no handler inferred | AssociationRegistry handles no-match safely |
| conflicting extension + explicit MIME | explicit MIME/type wins | mapping from canonical MIME/type, with safe fallback | all consumers agree with explicit fact | current consumers are inconsistent |
| rename inferred resource | new extension re-derives | new canonical language | Search/Properties update; NodeId unchanged | `renameNode` identity behavior exists |
| rename explicit/pinned resource | MIME unchanged; name changes only | language follows explicit MIME or accepted pin policy | no silent erase of explicit type | current `FsNode.mime` is copied by FsService rename path |

## Support-proof rule

Rows marked “accepted if classifier declares support” must be narrowed by the
integrated association/content registry before implementation. The implementor
must not broaden support merely because Monaco or a browser can decode a format.
