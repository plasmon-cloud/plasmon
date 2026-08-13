# Issue #178 — integrated authority map

Refresh basis: fetched `origin/release/0.1.0-r2` at `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`. No open implementation PR owns #178. This is future preparation only; #189's accepted source is the release branch, not an unmerged branch.

## Actual vocabulary

| Concept | Actual authority | Current observable contract | #178 boundary |
|---|---|---|---|
| persisted resource identity | `FsNode.id` / `NodeId`, `FsService` | rename/move preserve identity; consumers address nodes by id | preserve through inferred-type changes |
| persisted MIME | `FsNode.mime` | optional metadata returned by FsService; managed system/Neutron projections use sentinel MIME values | distinguish explicit/pinned/imported metadata from a guess |
| canonical resource classification | `classifyResource(node)` in `src/os/fs/resourcePolicy.ts` | returns `directory`, `ordinary-file`, `shortcut`, `atom`, `system-app`, or `neutron-app`, plus ownership and validated metadata | extend/consume, do not replace semantic kind with suffix |
| system-app identity | `readSystemAppMetadata` and `SYSTEM_APP_MIME` | requires sentinel MIME and validated metadata | never infer execution from `.sys`/extension |
| Neutron-app identity | `readNeutronAppMetadata` and `NEUTRON_APP_MIME` | requires sentinel MIME and validated metadata | never infer installed app from `.neutron` alone |
| association/open authority | `HandlerAssociationRegistry` + `OpenService` / `AssociationRegistry` | resolves handlers from node metadata, MIME, extension/logical rules and persisted defaults; activation delegates to OpenService/filesystem opener | stays independent from visual/editor hints |
| Search category | `categorizeFsNode` / `categorizeNonApplicationFsNode` in `os/shell/search.ts` | canonical classification identifies Neutron apps; current media fallback uses MIME prefixes plus local suffix set; otherwise documents | consume canonical type/category once #178 exposes it |
| Properties facts | Properties loaders/panels consume `FsNode` and association data | current Properties contract is resource metadata/handlers, not a separate MIME authority | no local suffix table |
| Text language | `native-apps/text/editorModel.ts::editorLanguageForName(name)` | current extension-only table returns Monaco labels | replace consumer with canonical derivation; do not resurrect a MIME-argument API |
| Markdown language | `MarkdownEditor.tsx` passes literal `"markdown"` to its editor surface | current Markdown path does not derive from a global MIME helper | define a canonical language hint at integration boundary |
| Visual presentation | `os/visual/presentation.ts`, `assets.ts`, primitives and consumer adapters | icon/title/thumbnail decisions are presentation, not MIME persistence | consume classification/type facts, retain fallbacks |
| import/create/rename | FileManager helpers + FsService `createFile`/`rename`/document flows | create/import may persist MIME; rename currently changes name through FsService | preserve explicit MIME; inferred type may change after rename |

## Current limitation

Integrated #189 provides canonical semantic classification and MIME inference
consumer vocabulary, but the release branch does not expose a single general
`deriveMime`/`deriveLanguage` function consumed by all surfaces. Existing
`classifyResource()` does not encode ordinary extension MIME. Therefore a full
#178 RED cannot honestly call a future classifier or cast a future API into
existence. The packet status is **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**
until the implementor establishes and exports the accepted #189-derived
ordinary-resource metadata seam.

The current truthful RED is the existing cross-consumer divergence:
`editorLanguageForName("note.md")` is extension-only while `FsNode.mime` and
Search/Properties remain independently sourced. The executable test must be
updated only after the real integrated API is present.

## Required authority rule

`FsNode.mime` may be authoritative persisted metadata; canonical classification
answers semantic resource kind; derived MIME is a deterministic hint when no
stronger metadata exists; editor language is a consumer hint; Visual is
presentation; AssociationRegistry decides handlers. No one may silently
promote an editor hint or icon category into execution authority.
