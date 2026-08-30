# Photos


Photos is the native image viewer for browser-supported image resources.

`media.ts` owns deterministic image classification/object-URL and sibling-navigation helpers. `fullscreen.ts` wraps optional browser fullscreen behavior. `Photos.tsx` renders the viewer and navigation UI.

Images should preserve source identity/aspect ratio through the shared visual/media conventions. Browser fullscreen or decode capabilities may be unavailable and should degrade cleanly rather than becoming uncaught failures.

## Refactor direction

Keep media classification/navigation and object-URL lifetime outside React. Share generic media/resource helpers with other viewers where semantics genuinely match, while keeping image-specific zoom/navigation behavior local.

## Testing

Use fast tests for classification, sibling navigation, URL lifetime, and fullscreen decision/error handling. Use real-browser tests for decode/loading, fullscreen policy, object URLs, keyboard navigation, and visual scaling/aspect behavior.
