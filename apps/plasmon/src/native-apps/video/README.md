# Video


Video is the native browser-media player for association-selected video files and supported web media targets.

`media.ts` owns deterministic URL validation, media-type hints, native codec capability interpretation, playback error classification, supported web-video normalization, and object-URL lifetime. `VideoPlayer.tsx` owns media/iframe presentation and browser event handling.

Recognizing a media resource is distinct from the current browser being able to decode it. Capability errors should communicate that boundary without corrupting shared association/resource semantics.

## Refactor direction

Keep media normalization/capability/error logic below React and keep browser media element/iframe behavior in the player. Share generic object-URL/media helpers with Photos where semantics match, but do not invent a fake codec/transcoding layer in UI code.

## Testing

Use fast tests for URL/type/capability/error/object-URL helpers. Use real-browser/package tests for `<video>` decoding/load events, iframe embeds, object URLs, fullscreen/controls, and codec-policy failure paths because those depend on the browser engine.
