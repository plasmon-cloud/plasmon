# js-dos browser health contract

Strict first-party health observes package requests, script load, worker/WASM,
canvas/player readiness, pageerror, console error/warn, unhandled rejection,
ORB/CORS/CSP/SecurityError, audio/GPU diagnostics, and storage bootstrap.

Current exact allowances: two #202 storage messages; scoped #187 js-dos audio/GPU
diagnostics after readiness. Do not apply Monaco or icon allowances. Future
#202 removes only its two rules. #64 adds save/import health only after a real
runtime bridge. #121 requires no external runtime request and explicit fixture
flag. `data-jsdos-ready` is a useful phase marker but cannot by itself prove
healthy storage or progress persistence.
