# Issue #178 — FULL RED PACKET

Classification: **FULL RED PACKET**

## Executable gate

`apps/plasmon/test/tdd/.red/issue-178.red.test.ts`

Focused command:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-178.red.test.ts
```

Current result: setup succeeds; one intended assertion fails immediately with
`inferImageMime("note.png", "text/plain")` returning `image/png` instead of the
explicit MIME, and the editor-language assertion is reached after that failure
when run independently. The rename/NodeId/Search characterization passes.

## Required contract

```text
authoritative resource metadata
  > explicit MIME
  > filename-derived MIME/type/language
  > safe unknown fallback
```

Coverage matrix includes text, Markdown, JS, TS, JSON, HTML, CSS, image, audio,
video and unknown extension classes in the implementation handoff. The gate
specifically prevents two known duplicated consumers from silently guessing over
explicit metadata, then verifies that rename preserves NodeId while derived
classification remains coherent for Search.

Properties must consume the same canonical result; Monaco language may map the
canonical result to its editor vocabulary. AssociationRegistry/OpenService
remain independent opening authority and are not replaced by this classifier.

## Dependency

PR #207 implements #189 on `release/0.1.0-r2` but is not merged into the release
branch. This packet intentionally targets the current TDD staging composition;
when #189 integrates, replace the consumer-specific assertions with the actual
classifier result vocabulary and retain the cross-surface outcomes.
