# Issue #174 — Search native projection closure audit

Integrated release: `origin/release/0.1.0-r2` at
`82f176a6f11a163197a270a6c2275dde0f95a2e9`.

Disposition: **COMPLETE / NO IMPLEMENTATION REQUIRED for current canonical
acceptance**. No open PR owns #174.

## Authority

- Filesystem owns canonical `/System/*.sys` identity and metadata.
- `classifyResource` owns system-app classification.
- `searchFilesystem` projects the canonical filesystem resource.
- `searchApplicationEntries` supplies direct native registry presentation.
- `searchShell` de-duplicates a system `.sys` file when its canonical handler is
  already represented by the direct native result, while preserving filesystem
  identity for the result that remains.
- Search activation delegates to `activateSearchFilesystemResult` and the
  canonical open authority.

No application catalog or suffix-only Search authority is introduced.

## Acceptance audit

| Criterion | Integrated evidence | Result |
|---|---|---|
| one visible native result, no friendly/raw duplicate | `search.ts` `directNativeHandlers` filter + `issue-174.red.test.ts` | proven |
| `.sys` never Documents | `categorizeFsNode` uses `classifyResource` + same RED test | proven |
| identity derives from canonical resource/metadata | Search filesystem result and activation characterization | proven |
| hidden native policy | hidden `.Properties.sys` test through `searchFilesystem` | proven |
| no Running/Not running labels for native resources | stopped/running classification test; direct Element vocabulary remains separate | proven |
| consistent user-facing native presentation | `Plasmon application` subtitle and current native result vocabulary | proven core |
| no parallel source of truth | resource classifier, Search projection tests, cross-surface open tests | proven |

## Executed evidence

```text
bun test /tmp/plasmon-runway/apps/plasmon/test/tdd/.red/issue-174.red.test.ts
```

Result: **3 passed, 0 failed, 13 expect() calls** against the exact integrated
release. Existing Search projection and cross-surface tests provide additional
permanent coverage.

No browser boundary is required for this deterministic source/projection
contract. Search rendered geometry remains #175/#193 scope; this closure does
not claim that separate browser acceptance.
