# Native Photos

`native:photos` reads image bytes only through `FsService`, creates a browser Blob/object URL, and delegates pan/zoom behavior to `@panzoom/panzoom`. Object URLs and Panzoom instances are released on target changes/unmount. Supported sibling images can be navigated with the arrow keys without introducing a second media library or filesystem.
