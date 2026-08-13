# #64 filesystem layout design envelope

| representation | stable NodeId | user-visible/Trash | rename/move | export/corruption | atomicity/migration | disposition |
|---|---|---|---|---|---|---|
| sibling `<game>.zip.save` | weak unless metadata links source | visible collision/name coupling | path breaks | easy export; opaque | replace/write race | reject as sole identity |
| hidden managed save directory keyed by NodeId | strong | can hide; explicit Trash policy | survives | payload + manifest | atomic temp/commit possible | candidate |
| metadata record + payload resource | strong | resource policy needed | survives | clear schema/checksum | two-resource transaction concern | candidate |
| embedded game bundle mutation | strong-ish | corrupts original/source | bad copy semantics | poor | unsafe | reject by Issue constraint |
| browser IndexedDB/OPFS | browser origin, not NodeId | not FS user data | path/identity bridge absent | opaque | runtime-private | reject |

PRESERVE: FsService authority, stable NodeId, original bundle immutability,
explicit compatibility/fallback. CHANGE: add runtime save bridge and durable
record only after API validation. UNSPECIFIED: hidden naming, schema version,
transaction mechanism, user visibility and export command.
