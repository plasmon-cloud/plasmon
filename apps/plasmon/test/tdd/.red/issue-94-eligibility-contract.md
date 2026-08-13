# Issue #94 video-thumbnail eligibility contract

Status: **BROWSER SPEC ONLY / REFACTOR RED GAP**. Exact supported codecs and
size policy must be accepted by production implementation; this document does
not invent a decoder table.

## Eligibility

A candidate is eligible only when all are true:

- ordinary file resource with a supported video MIME/type from the accepted
  media/association vocabulary;
- nonzero size;
- size at or below a conservative bounded thumbnail-read limit;
- not a system/Neutron projection or shortcut unless an explicit target policy
  resolves it first;
- no prior failure/duplicate in-flight request for the same stable resource
  revision.

An ineligible, oversized, unsupported, empty, malformed, or failed candidate
returns the generic video/file fallback without reading unbounded bytes.

## Observable contract

- accepted candidate eventually supplies one representative still;
- still retains source aspect ratio and is contained by the existing thumbnail
  frame;
- no audible playback/autoplay is initiated;
- repeated renders for one stable NodeId/content revision do not start
  uncontrolled duplicate decodes;
- revision/name/mime changes invalidate the prior request and clean resources;
- failure is safe and deterministic, not a broken image or unhandled rejection.

Eligibility is deterministic and Bun-testable once a real production policy seam
exists. Actual decode and frame extraction remain Playwright/browser behavior.
