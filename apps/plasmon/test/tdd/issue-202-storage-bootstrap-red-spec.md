# #202 storage bootstrap RED specification

**Disposition: BLOCKED — IMPLEMENTATION OWNER UNAVAILABLE DURING ACTIVE REFACTOR
PROGRAM; PACKAGED BROWSER SPEC ONLY locally.**

Installed gate: explicit demo fixture -> normal FileManager/OpenService -> real
js-dos host; observe player/canvas readiness; collect pageerror, console error,
request failures and security failures. Current canonical RED is:

- `Failed to execute 'estimate' on 'StorageManager'`;
- `Storage directory access is denied because the context is sandboxed`.

Expected future GREEN: real installed player/canvas ready; no either message; no
#202 allowance; no network dependency; unchanged sandbox; preserved FS/open
routing. A canvas element, mocked StorageManager, suppressed console error, or
forced `allow-same-origin` is invalid evidence.
