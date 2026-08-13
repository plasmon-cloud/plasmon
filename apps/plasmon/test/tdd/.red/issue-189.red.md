# Issue #189 — canonical resource classification and MIME inference

## Disposition

**HEADLESS RED.** The focused gate reaches externally meaningful classification
assertions and currently fails because FileManager's `fileVisualKind()` gives
`.md` extension precedence over explicit MIME metadata, and Search classifies
canonical `.sys` system resources as generic documents.

Run:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-189.red.test.ts
```

The expected RED is not a source-shape assertion. It compares behavior exposed
by current FileManager classification and Search category consumers.

## PRESERVE

- Persisted `FsNode.mime` and resource metadata are filesystem facts.
- `classifyResource()` owns system/Neutron semantic identity and resource policy.
- `AssociationRegistry` remains handler matching/default-open authority.
- Rename preserves NodeId while derived classification may change with the new
  name when no stronger metadata exists.
- Unknown resources remain safe generic files.

## CHANGE

- Establish one effective-classification precedence: explicit authoritative MIME
  or resource metadata before extension inference, then safe unknown fallback.
- Make Search, FileManager, Properties, Text/Markdown hints, and related
  consumers consume the same derived result.
- Ensure `.sys` and `.neutron` semantics come from canonical metadata/resource
  identity rather than scattered suffix checks.
- Remove competing MIME/type tables only as each consumer migrates.

## UNSPECIFIED

- Final classifier module/file/API names.
- Exact language enum and editor-specific mapping.
- Search labels and UI wording beyond semantic category correctness.
- Whether content probing is added; no such framework is required by this gate.

## Existing evidence

- `src/os/fs/resourcePolicy.ts` already classifies system and Neutron metadata.
- `src/os/file-manager/file-icons.ts` owns a separate extension/MIME visual table.
- `src/os/shell/search.ts` has a separate media extension table and currently
  only promotes Neutron projections to the Apps category.
- `src/os/file-manager/properties.tsx` derives friendly labels independently.
- `src/os/file-manager/model.ts` uses filename probes for association payloads.
- Native Text/Markdown and Photos/Video each retain app-specific inference;
  these may map canonical output to app behavior but must not silently become
  global authority.

## Authority boundaries for implementor

Filesystem metadata/resource policy > canonical derived classifier > consumers.
Association matching/open dispatch and Visual presentation remain separate
authorities. Do not solve #189 by changing shortcut execution, icon composition,
or handler selection.

## Green baseline

The existing resource-policy, Search, FileManager icon, Properties, association,
and cross-surface open tests must remain green. The RED gate is intentionally
kept outside ordinary Bun discovery under `.red/`.
