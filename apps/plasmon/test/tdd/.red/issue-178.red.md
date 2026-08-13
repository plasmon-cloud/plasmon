# Issue #178 — dependency-wait specification

Disposition: **WAIT FOR DEPENDENCY**.

## Validation repair

The former packet was invalid. It cast the real one-argument
`editorLanguageForName(name)` production function into a fictional two-argument
signature, and it required the image-specific helper to return `text/plain`
although that helper's actual contract returns image MIME or `null`. The
speculative test has been deleted; no test-local policy is retained.

PR #207 is the active #189 implementation and is not yet integrated into
`release/0.1.0-r2`. #178 must consume the accepted production classifier result
rather than inventing a compatibility API. Do not mark #178 RED until that seam
is observable on the current accepted composition.

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

At that point stage a production-backed Bun gate for the complete cross-surface
contract. Until then this issue is genuinely blocked, not a valid RED packet.
