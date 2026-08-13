# Filesystem / NodeId mutation acceptance matrix

Refresh: integrated `f4ac3b4`. This matrix maps durable behavior and remaining
protection; it does not create a competing filesystem policy.

| Mutation | NodeId | Parent/name | Metadata | Presentation | Association/open | Persistence | Existing evidence | Owner/gap |
|---|---|---|---|---|---|---|---|---|
| create file/folder | new | requested/collision-safe | requested metadata | canonical classify/Visual | AssociationRegistry | FsService | `fs.test.ts`, FileManager final/gate tests | #178 for inferred type |
| rename | preserved | name changes, parent same | explicit MIME/metadata preserved by FsService | inferred presentation may update | open uses same NodeId | FsService | `refactorGuards.test.ts`, Text document tests | #178 precedence proof |
| move | preserved | parent changes | preserved | recomposed by NodeId | target identity preserved | FsService | refactor guards/file manager tests | green |
| copy | new | target parent/name collision | copied according to FsService | new identity presentation | independently resolved | FsService | clipboard tests | #65/#92 status separate |
| canonical shortcut | new shortcut NodeId; target NodeId preserved | current directory/name collision | shared `plasmon.shortcut` metadata | target + overlay | dispatcher dereferences NodeId | FsService | desktopCore/refactor guards/resourceOpenCrossSurface | #44 closure failure-atomicity gap |
| Trash | original NodeId preserved in Trash entry | parent becomes `.Trash`/entry metadata | restore metadata retained | hidden from source, Trash presentation | open rejects trashed target | Fs/Trash | `trashLifecycle.test.ts`, desktopCore | #172 composed closure |
| restore | original NodeId | original/selected destination | restore metadata consumed, not redefined | Desktop recomposition | canonical opener after restore | Fs/Trash | Trash lifecycle/refactor guards | #172 collision gate |
| import | new | destination/name | imported MIME/bytes | thumbnail/type presentation | Association independently resolves | FsService | `final-gate.test.ts`, #65 packet | #65 active progress |
| paste copy | new | destination/collision name | copied metadata/bytes | recomposed | independent identity/open | FsService/clipboard | clipboard tests, #65 packet | #65 active progress |
| paste cut/move | preserved | destination changes | preserved | recomposed | stable identity | FsService/clipboard | clipboard/model tests | #65 active progress |
| root migration/bootstrap | managed roots stable per FsService | canonical `/System`, `/Desktop`, etc. | managed ownership/version metadata | projections | managed native app authority | persistence/bootstrap | `desktopCore`, bootstrap/refactor guards | #82 cross-root |
| Start reconciliation | shortcuts stable after seed; user-customized preserved | canonical Start tree | seed ledger metadata | Start presentation | shortcut dispatcher | FsService | start migration/runtime tests | #169/#194 |
| resource classification | preserved | no mutation | effective type derived/persisted policy | FileManager/Search/Properties/Editor | Association independent | metadata authority | #189 integrated; #178 incomplete | #178 |
| managed app projection | stable projection identity across recomposition | `/Apps` | sentinel MIME + metadata | Visual/Element | Neutron authority | persistence | refactor guards | #171/#190 |

## Uncovered/conditional gaps

- #44 needs explicit failure-atomicity evidence if FsService create failure can
  be injected without violating real-graph testing.
- #92 waits for accepted #65 operation vocabulary.
- #178 waits for ordinary effective MIME/language seam.
- #172 composed gate passed against the exact integrated #192 source in a clean
  detached worktree; Trash semantics and NodeId identity remain covered by the
  same gate plus the existing lifecycle suites.
- #82 remains cross-surface bootstrap ownership for Luna-D; no duplicate packet
  is created here.
