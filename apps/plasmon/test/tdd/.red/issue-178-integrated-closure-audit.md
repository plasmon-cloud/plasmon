# Issue #178 integrated closure audit

Refresh: `origin/release/0.1.0-r2` =
`f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`. PR #207/#189 is integrated; no
active #178 PR. This audit corrects the earlier dependency-wait packet, which
was based on pre-integration source.

## Criterion evidence on integrated release

| #178 criterion | Integrated production authority | Permanent evidence | Result |
|---|---|---|---|
| `.js`, `.html`, `.md`, `.json`, `.ts`, `.css` derive consistently | `classifyResource(node).type` in `os/fs/resourcePolicy.ts` | `apps/plasmon/test/refactor/189/issue-189.test.ts` representative classifier tests | PROVEN |
| image/audio/video families | same canonical `TYPE_BY_EXTENSION` and explicit MIME path | #189 test families plus Photos/Video tests | PROVEN |
| explicit MIME wins conflicting extension | `classifyType` explicit branch | #189 explicit-over-derived tests; `friendlyKind` and editor adapter assertions | PROVEN |
| inferred rename changes type | same NodeId + `classifyResource` after name change | #189 rename characterization; FsService rename identity tests | PROVEN |
| explicit MIME survives rename | FsService rename metadata preservation + explicit classifier branch | FsService/refactor guard rename tests; #189 explicit precedence | PROVEN by composed authorities |
| NodeId stable through rename | FsService | `test/refactorGuards.test.ts`, FS tests | PROVEN |
| Search consumes canonical classification | `os/shell/search.ts::categorizeFsNode`, `fileSubtitle`, searchable text | #189 Search classification tests and release Search tests | PROVEN |
| Properties consumes canonical type/MIME | `os/file-manager/properties.tsx::friendlyKind` | #189 Properties assertion | PROVEN |
| Monaco consumes canonical language | `editorLanguageForResource` -> `classifyResource` | #189 editor-language assertion; release TextEditor import | PROVEN |
| AssociationRegistry remains independent | registry matching rules consume node independently | #189 AssociationRegistry test | PROVEN |
| unknown safe fallback | `type.source="fallback"`, `mime=null`, contentKind unknown | #189 unknown fallback test | PROVEN |
| system/Neutron identity does not arise from suffix | validated sentinel MIME + metadata | #189 system/Neutron/spoof tests | PROVEN |

## Disposition

**ALREADY GREEN — COMPLETE CORE ACCEPTANCE PROVEN on integrated release.** No
new RED should be staged. The Luna worktree is stale and cannot execute the
integrated test without a staging refresh; this is a lane operational limitation,
not a product failure.

Permanent integrated destination:

- `apps/plasmon/test/refactor/189/issue-189.test.ts`;
- `apps/plasmon/src/os/fs/resourcePolicy.ts`;
- `apps/plasmon/src/native-apps/text/editorModel.ts`;
- `apps/plasmon/src/os/file-manager/properties.tsx`;
- `apps/plasmon/src/os/shell/search.ts`;
- existing FsService/AssociationRegistry/rename/open tests.

The earlier `issue-178.red.md` dependency-wait statement must be treated as
historical and superseded by this audit after #189 integration.
