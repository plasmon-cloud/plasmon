# EmulatorJS browser health contract

Required: local package-only requests for host, loader, CSS, core, compression
worker/data and ROM; no 4xx/5xx/ORB/CSP/security errors; actual host-ready,
configured, loader-ready and game-started phases; no unexpected pageerror,
console error, unhandled rejection, iframe error, or runtime timeout; canvas
and input are inside the native runtime window; terminate removes iframe and
listeners.

Allowed unrelated baseline errors remain owned by #187/#190/#202 and must not be
copied here. The child must retain opaque-origin sandbox and no local durable
storage. A frame/canvas or synthetic postMessage is not runtime readiness.
