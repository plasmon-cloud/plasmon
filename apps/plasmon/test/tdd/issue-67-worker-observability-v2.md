# #67 worker observability v2

A valid gate layers independent signals: (1) Monaco surface mount/loading,
(2) `Worker` constructor interception or browser Worker object evidence,
(3) request/response URL and 2xx, (4) Worker error listener absence,
(5) Monaco `onDidCreateModel`/language service operation that requires worker
infrastructure, and (6) edit/save operation. Instrumentation must be attached
before opening the app and only observe real browser APIs; it must not replace
Worker or synthesize messages.

Chromium and Firefox use the same semantic journey. Collect pageerror,
console.error/warn, requestfailed, HTTP responses, Worker errors, SecurityError,
ORB/CORS and fallback warnings. The strict #187 baseline is inherited but only
#67/#89 rules may be retired here. HTTP success/editor DOM alone is rejected.
