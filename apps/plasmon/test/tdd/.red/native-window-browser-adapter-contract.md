# Issue #199 — browser adapter contract

## Adapter inputs/outputs

```text
WindowState + WindowManager authority
+ browser pointer/focus/ResizeObserver events
-> DOM chrome + manager commands
```

The adapter may:

- capture pointer on the originating titlebar/resize handle;
- calculate pointer deltas through accepted pure helpers;
- render authoritative state and temporary interaction preview;
- suspend iframe pointer interception and text selection during gestures;
- report pointer cancel/lost capture and cleanup.

It must not:

- store a second WindowManager;
- decide z-order, focus fallback, snap geometry, close negotiation, or default
  placement independently;
- infer lifecycle completion from animation alone;
- persist DOM coordinates in Shell;
- create a `NativeWindow2` permanent path.

## Browser acceptance boundaries

Playwright is justified for pointer capture, iframe hit testing, actual CSS
rectangles, viewport/ResizeObserver behavior, snap edge gestures, resize handles,
inert/minimized focus, and close-animation/chrome geometry. Bun covers manager,
geometry, resize math, snap state, MRU, and close negotiation.
