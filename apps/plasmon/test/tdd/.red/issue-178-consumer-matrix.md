# Issue #178 — consumer matrix and executable plan

Status: **VERIFIED CORE RED / INCOMPLETE ACCEPTANCE**. The integrated release
has canonical semantic classification but not yet a general ordinary-resource
MIME/language derivation API that this lane can consume honestly.

| Canonical requirement | Production authority | Observable behavior | Lowest truthful layer | Existing evidence | Missing evidence |
|---|---|---|---|---|---|
| ordinary extension derives one type | future accepted #189-derived resource metadata | `.js/.html/.md/.json/.ts/.css` expose same type | Bun | local Text/content tests prove fragments | integrated shared derivation result |
| explicit MIME wins | FsNode/FsService metadata | conflicting name does not overwrite MIME | Bun | FsNode metadata and association tests | composed create/rename/Properties proof |
| inferred rename updates | FsService rename + derivation | same NodeId, new derived type | Bun | rename identity tests | canonical metadata refresh test |
| explicit rename preserves | FsService rename | pinned MIME remains | Bun | FsService identity/rename tests | explicit marker/policy proof |
| Search classification | `search.ts` + classifier | category comes from canonical result | Bun | Search projection tests | no independent suffix table |
| Properties facts | Properties loader + FsNode | displayed MIME/type agrees | Bun/RTL | Properties source inspection | cross-surface fixture |
| Text language | editor adapter | Monaco label comes from canonical hint | Bun | `editorLanguageForName` tests | remove duplicate extension authority |
| Markdown language | Markdown editor/host | markdown hint is canonical input | RTL | literal `markdown` inspected | shared language input |
| association opening | AssociationRegistry/OpenService | handler selection unchanged by visual hint | Bun | association/open tests | conflicting-type composed proof |
| Visual presentation | Visual/resource presentation | icon/title fallback follows semantic type | RTL/browser only as needed | Visual primitives tests/inspection | type-driven consumer test |
| unknown safety | FsService/classifier/AssociationRegistry | no crash/no executable guess | Bun | no-match association tests | unknown binary end-to-end |

## Exact test packet once seam exists

Create one deterministic fixture using the real headless Plasmon environment and
real FsService. It should create resources with and without MIME, rename them,
then query the production classifier/derivation function by its exported type
(not a cast). Assertions should cover:

- expected canonical type and language for every supported row in the precedence
  table;
- explicit MIME remains after rename;
- inferred type changes after rename;
- NodeId equality before/after rename;
- Search result category/identity uses that same result;
- Properties loader sees the same MIME/type;
- AssociationRegistry still resolves based on its own accepted matching rules;
- unknown resources return a safe value and do not throw.

A separate RTL test should render actual Properties/Text consumer composition only
if the canonical harness can inject the real production service graph. A browser
run is not required for deterministic metadata semantics.

## Forbidden substitutes

- no two-argument `editorLanguageForName(name, mime)` revival;
- no duplicated MIME table in the test;
- no fake `deriveResourceMetadata` cast;
- no assertion that a filename alone creates a system/Neutron app;
- no test-local reimplementation of Search or Properties classification.
