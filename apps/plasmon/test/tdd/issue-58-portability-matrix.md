# #58 portability matrix

| path | import | export | canonical identity | evidence preserved? | current evidence |
|---|---|---|---|---|---|
| Markdown | `.md`/`.markdown` | readable Markdown | new AtomId | no participant evidence implied by checkbox | markdown tests/e2e |
| TODO/text | `.txt`/`.todo` | readable text subset | new AtomId | no checkbox-to-result conversion | markdown tests/e2e |
| source path | Files canonical Workspace path | destination path | provenance only | etag/media type retained | NeutronFilesPort tests |
| unsupported formats | reject | reject/not applicable | none | actionable error | service validation path |

Portability is not canonical storage, history, or Atom identity. Import uses
normal Neutron Files and the installed e2e approves the Files tool boundary.
