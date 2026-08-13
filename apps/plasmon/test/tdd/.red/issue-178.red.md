# Issue #178 — integrated closure disposition

Disposition: **ALREADY GREEN — COMPLETE CORE ACCEPTANCE PROVEN** on integrated
release `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`. See
`issue-178-integrated-closure-audit.md`.

## Validation repair

The former packet was invalid. It cast the real one-argument
`editorLanguageForName(name)` production function into a fictional two-argument
signature, and it required the image-specific helper to return `text/plain`
although that helper's actual contract returns image MIME or `null`. The
speculative test has been deleted; no test-local policy is retained.

PR #207/#189 is integrated into `release/0.1.0-r2`. The accepted production
classifier/result seam is now observable in the release source. Do not reopen
or manufacture a competing RED; the Luna staging worktree requires a refresh
before it can execute the integrated tests.

## Required post-#189 contract

Use real production nodes and the accepted classifier vocabulary to cover:

- `.txt`, `.md`, `.js`, `.ts`, `.json`, `.html`, `.css`;
- representative image, audio and video;
- unknown extension and unknown text-like/binary fallback;
- explicit MIME precedence over suffix inference;
- conflicting suffix plus explicit MIME;
- explicit MIME surviving rename with stable NodeId;
- derived classification changing after rename only when it was not explicitly
  pinned;
- Properties type, Search category, and the real editor-language consumer;
- AssociationRegistry/OpenService remaining independently authoritative.

The production-backed Bun gate is permanently present in the integrated #189
regression suite. This packet is retained as the historical invalid/dependency
record, while the integrated closure audit is authoritative.
