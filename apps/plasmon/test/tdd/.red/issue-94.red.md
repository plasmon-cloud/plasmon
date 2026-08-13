# Issue #94 — bounded video thumbnail specification

Classification: **BROWSER BOUNDARY / RED SPECIFICATION** with a production media
policy seam still required.

## Current boundary

Image thumbnail lifecycle is deterministic and green. The shared Visual
`MediaThumbnail` can frame a media source, but FileManager has no bounded local
video frame-extraction path. `VideoPlayer` owns playback and must not be made the
thumbnail decoder. No fake Bun RED is staged because decode, seek timing, frame
availability, browser codec support, object URL lifetime and cancellation are
browser/media contracts.

## Smallest safe policy

| Policy | Required contract |
|---|---|
| Eligible resources | ordinary filesystem files whose canonical classification/MIME is `video/*` and whose extension is in the explicitly supported thumbnail policy; never folders, `.sys`, `.neutron`, shortcuts, or unknown binaries merely by suffix |
| Decode | create an isolated muted off-DOM video element or equivalent bounded media probe; never autoplay and never attach to a persistent player/window |
| Timing | wait for metadata, seek to a deterministic bounded preview time (normally 0 or a small fixed fraction only when duration is finite), then capture one frame; no unbounded `loadeddata`/seek loop |
| Dimensions | cap decoded/captured bitmap dimensions to a documented maximum; preserve source aspect ratio and use shared containment framing |
| Cleanup | revoke every object URL exactly once; release video source/listeners/canvas/blob references on success, failure, cancellation and unmount |
| Failure | unsupported codec, malformed bytes, timeout, missing duration, seek failure and decode error produce the shared deterministic media fallback, not a broken-image storm |
| Cancellation | stale async work cannot publish a frame into a renamed/removed/replaced FileEntry; unmount aborts/invalidates the probe |
| Audio | `muted`, no autoplay, no controls, no audio output; thumbnail probing must not alter the active Video app |
| Ownership | presentation may request a bounded frame lease, but filesystem bytes/resource identity and VideoPlayer playback remain separate authorities |

## Browser fixture requirement

Use one redistribution-safe local fixture with a permissively supported codec
(e.g. a tiny WebM/VP8 or repository-approved equivalent), one deliberately
unsupported/malformed video byte fixture, and one portrait/aspect-ratio fixture
if the first file is not portrait. Do not fetch a remote CDN or commit a
copyrighted sample. The fixture must be served from the installed Plasmon
package or a test-owned same-origin route and its bytes must be deterministic.

## Required browser assertions

1. supported fixture produces one contained preview with bounded dimensions;
2. source aspect ratio is preserved rather than cropped;
3. unsupported/malformed fixture shows fallback and does not create repeated
   requests/errors;
4. unmount/removal before seek completion leaves no stale frame and revokes its
   object URL once;
5. no autoplay/audio event occurs;
6. replacing the node during an in-flight decode cannot update the replacement.

Playwright owns real codec/decode/seek/cleanup observation. Bun can later cover
pure eligibility and a lease state machine only after production exposes that
small seam; this packet intentionally does not invent one.
