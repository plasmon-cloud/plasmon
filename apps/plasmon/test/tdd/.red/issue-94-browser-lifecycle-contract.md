# Issue #94 browser lifecycle contract

The future browser test must use a tiny authored/redistribution-safe fixture
served through the canonical packaged FileManager path. No fixture currently
identified on this lane is sufficient evidence, so this remains adoption-ready
specification rather than executed RED.

## Required sequence

1. Create/import a supported tiny video through normal FsService/FileManager
   production flow.
2. Observe one bounded byte/object URL request for the stable NodeId/revision.
3. Create a detached media element with muted/no-audio semantics and no
   `play()` call; load metadata/data through browser events.
4. Seek/capture an early representative frame only after accepted readiness.
5. Draw to a bounded canvas or equivalent browser mechanism and expose still via
   the shared thumbnail presentation.
6. Assert frame geometry, source/rendered ratio, and containment.
7. Unmount/change revision/cancel and assert media, timer, object URL and canvas
   resources are cleaned up.
8. Re-render the unchanged entry and assert no uncontrolled repeated decode.
9. Exercise unsupported codec, error, oversized, and empty candidates and assert
   generic video fallback.

## Browser evidence

Capture request/console evidence, decode/error events, `play()` invocation count
(expected zero), object URL create/revoke balance, and measured frame/image
rectangles. Start from strict browser health and add only #94-owned allowances.

Current production has no FileManager video-thumbnail seam, so creating a test
that imports a future loader or mocks `HTMLVideoElement` would be invalid.
Disposition: **BROWSER SPEC ONLY / REFACTOR RED GAP**.
