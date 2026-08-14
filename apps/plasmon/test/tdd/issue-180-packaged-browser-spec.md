# #180 packaged browser specification

Against an actually installed Plasmon iframe under the normal Neutron sandbox:

1. open a representative image through canonical FS/open association;
2. record `document.fullscreenEnabled` and force no policy grant;
3. activate Photos Expand;
4. assert no `pageerror`, unhandled rejection, or Photos-owned SecurityError;
5. assert the image and restore control are visible and contained in the usable
   Plasmon workspace (bounding boxes, not a fake DOM flag);
6. zoom/fit/pan remain available as applicable;
7. restore and assert prior window/view state coherently returns.

A separate environment where fullscreen is legitimately available may verify
browser-fullscreen enter/exit, but it is not the required product path. Do not
make fullscreen itself a prerequisite or swallow failures in a broad listener.
Status: **FINAL IMPLEMENTOR PACKET READY**; installed environment execution remains the acceptance boundary.
