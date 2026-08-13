# Issue #178 — consumer matrix and executable plan

Status: **ALREADY GREEN — COMPLETE CORE ACCEPTANCE PROVEN** on integrated
release. The local TDD worktree is stale, so this lane records integrated source
and permanent release evidence without claiming local execution.

| Canonical requirement | Production authority | Observable behavior | Lowest truthful layer | Existing evidence | Missing evidence |
|---|---|---|---|---|---|
| ordinary extension derives one type | integrated `classifyResource(node).type` | `.js/.html/.md/.json/.ts/.css` expose same type | Bun | `test/refactor/189/issue-189.test.ts` | none for core |
| explicit MIME wins | integrated classifier explicit branch | conflicting name does not overwrite MIME | Bun | #189 explicit-over-derived and Properties/Text assertions | none for core |
| inferred rename updates | FsService + integrated classifier | same NodeId, new derived type | Bun | #189 rename characterization + FsService tests | none for core |
| explicit rename preserves | FsService metadata + classifier precedence | pinned MIME remains | Bun | FsService identity and #189 explicit precedence tests | none for core |
| Search classification | integrated `search.ts` + classifier | category comes from canonical result | Bun | #189 Search classification and release Search tests | none for core |
| Properties facts | `friendlyKind` + classifier | displayed MIME/type agrees | Bun | #189 Properties assertion | none for core |
| Text language | `editorLanguageForResource` + classifier | Monaco label comes from canonical hint | Bun | #189 editor-language assertion and release Text import | none for core |
| Markdown language | Markdown editor accepted language input | markdown hint remains coherent | RTL | integrated source inspection; app behavior owned by C | no #178 core gap |
| association opening | AssociationRegistry/OpenService | handler selection unchanged by visual hint | Bun | association/open tests | no #178 core gap |
| Visual presentation | FileManager/Visual consumers of classifier | icon/title fallback follows semantic type | RTL/browser only as needed | #189 FileManager classification plus Visual tests | broader #190 presentation promotion |
| unknown safety | classifier fallback + AssociationRegistry | no crash/no executable guess | Bun | #189 unknown fallback and Association tests | none for core |

## Integrated executable evidence

`apps/plasmon/test/refactor/189/issue-189.test.ts` is the integrated deterministic
fixture using actual production vocabulary. It covers the following assertions
without casts or test-local policy:

- expected canonical type and language for every supported row in the precedence
  table;
- explicit MIME remains after rename;
- inferred type changes after rename;
- NodeId equality before/after rename;
- Search result category/identity uses that same result;
- Properties loader sees the same MIME/type;
- AssociationRegistry still resolves based on its own accepted matching rules;
- unknown resources return a safe value and do not throw.

A separate RTL test is not required for the core metadata semantics because
integrated Properties/Text consumers are directly covered by the release
characterization and their production imports are source-inspected. Browser is
not required for deterministic metadata semantics.

## Forbidden substitutes

- no two-argument `editorLanguageForName(name, mime)` revival;
- no duplicated MIME table in the test;
- no fake `deriveResourceMetadata` cast;
- no assertion that a filename alone creates a system/Neutron app;
- no test-local reimplementation of Search or Properties classification.
