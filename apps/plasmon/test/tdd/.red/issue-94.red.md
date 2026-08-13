# Issue #94 — bounded video thumbnails

## Disposition

**BROWSER BOUNDARY / RED SPECIFICATION.** Current production has no video
thumbnail extraction path: `thumbnail.ts` only loads images and `FileEntry`
only invokes the image loader. The acceptance requires real browser media
decoding for a legal tiny fixture, while eligibility, bounded reads, lifecycle,
and fallback policy should be deterministic Bun tests after the seam is chosen.

## PRESERVE

- Generic video icon fallback and resource classification.
- Filesystem byte/resource identity and no unbounded reads.
- No autoplay/audio side effects, object/media cleanup, and FileEntry pointer
  semantics.
- Shared Visual thumbnail containment from #93.

## CHANGE

- Add bounded deterministic eligibility and lifecycle policy for supported video
  resources.
- Capture a representative still through a browser media element/canvas or
  equivalent bounded mechanism, then render it through shared thumbnail
  presentation.
- Fall back safely on unsupported codec, decode/load/timeout/empty-resource
  failure and clean all media/object resources.

## UNSPECIFIED

- Size threshold, frame timestamp, helper/module names, cache lifetime, and
  fixture encoding. Do not add Video.js/transcoding or persistent cache.

## RED evidence

No image-only Bun test can honestly prove frame decoding, and no legal tiny
video fixture is currently part of the repository. This is a genuine browser
media boundary rather than a Happy DOM harness gap. Implementor must add the
smallest accepted fixture and deterministic helper tests alongside the browser
frame gate; do not fake a `<video>` success in RTL.
