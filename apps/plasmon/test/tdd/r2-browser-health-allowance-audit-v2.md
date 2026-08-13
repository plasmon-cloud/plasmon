# r2 browser-health allowance audit v2

Integrated release remains `f4ac3b4c`; active #211 head `7fae5af3` was polled live.

## Integrated allowances

The release health policy still has narrow allowances for:

- Kernel iframe sandbox warning (`console.warn`, `/chunks/`);
- #190 old `/static/plasmon/icons/` `ERR_BLOCKED_BY_ORB` and `ERR_ABORTED` requests;
- Search popup small geometry overflow owned by #175/#193;
- Monaco worker/sandbox diagnostics owned by #67/#200;
- js-dos storage bootstrap diagnostics owned by #202.

No integrated allowance was removed during this audit.

## Active #211 evidence

PR #211's exact-head packaged smoke added `test/e2e/plasmon-presentation-assets.spec.ts` and ran three smoke tests. The focused #190 test **failed**, not green:

- package assets were uploaded under `/app/plasmon/static/plasmon/icons/**`;
- the focused test observed requests, but expected response records were absent/undefined for `recycle-bin.svg` on the first run and `file.svg` on retry;
- #192 and the broad refactor smoke became flaky/failing on unallowed `net::ERR_ABORTED` folder icon requests;
- the failure reached the real browser and is not a parse/session block.

This is **EXECUTED PRODUCT RED / RED PROMOTION GAP — #190**, not a successful allowance retirement. The active PR must establish that every required representative asset is requested and receives HTTP 200 under the installed mount, then rerun the broad smoke with only #190's own allowance retired. #192 must not be declared broken solely from the shared #190 health failure until rerun independently.

The distinction remains strict: #190 cannot retire Monaco/js-dos/Kernel allowances, and #191 cannot borrow a green #190 result that does not exist.
