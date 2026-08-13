# Issue #178 — integrated authority map

Refresh basis: fetched `origin/release/0.1.0-r2` at `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`. No open implementation PR owns #178. #189 is integrated and its accepted classifier vocabulary is the release source.

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

## Integrated result

The integrated release now exposes `classifyResource(node).type` with extension,
MIME, content kind, language, and source (`explicit-mime`, `filename`, or
`fallback`). Search, Properties, FileManager icon classification, Photos/Video,
and Text's `editorLanguageForResource` consume that seam. The old divergence and
fictional two-argument editor API are no longer valid release assumptions.

See `issue-178-integrated-closure-audit.md`: the core #178 acceptance is
ALREADY GREEN on integrated release. The local TDD worktree is stale and must
not be used to claim execution against that source.

## Required authority rule

`FsNode.mime` may be authoritative persisted metadata; canonical classification
answers semantic resource kind; derived MIME is a deterministic hint when no
stronger metadata exists; editor language is a consumer hint; Visual is
presentation; AssociationRegistry decides handlers. No one may silently
promote an editor hint or icon category into execution authority.
