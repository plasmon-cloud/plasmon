# Issue #94 video-thumbnail authority map

Refresh: integrated release `f4ac3b4c9880da5c6ce3b344bde73acbed7179e3`.
No active PR owns #94. Status: **BROWSER SPEC ONLY / REFACTOR RED GAP**.

| Concern | Actual authority/seam | Current evidence | Missing seam |
|---|---|---|---|
| resource identity/bytes | FsService + `FsNode.id`/`fs.read` | image thumbnail loader and video player media lease | bounded video thumbnail request adapter |
| video type support | `native-apps/video/media.ts::inferVideoMime` and registered associations | video MIME/capability tests | FileManager thumbnail eligibility must consume accepted support without owning playback |
| object URL | `VideoPlayer` media helpers / browser URL | video media tests | thumbnail-specific lifetime owner |
| frame decode | browser `<video>` + canvas | no FileManager frame extraction seam | actual browser adapter |
| visual presentation | `ResourceIcon`/`MediaThumbnail` | image thumbnails use shared visual | video still input and fallback state |
| FileEntry lifecycle | `FileEntry.tsx` image-only lazy load effect | image cleanup tests | video load/cancel/re-render guard |
| fallback | generic file-type video icon | FileManager icon tests | explicit video thumbnail failure fallback |

`VideoPlayer` is not a valid thumbnail authority: it owns playback controls,
volume/fullscreen and app window lifecycle. A future implementation needs a
bounded FileManager/Visual adapter that reads FsService bytes, decodes through a
browser media element without playback, captures a still, and returns a
presentation-owned resource with cleanup.

No pure fake decoder or Video.js dependency is appropriate.
