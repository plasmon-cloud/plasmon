# r2 future surface failure-state matrix

| Surface/failure | Authority | Visible state | Retry? | Dismissal | Layer |
|---|---|---|---|---|---|
| Search query/list failure | FsService/Search | alert, no false success | only accepted refresh action | alert/flyout policy | Bun + RTL |
| Search activation failure | OpenService/Process/Neutron/FS | action error; chosen busy ends | no guessed fallback | dismiss/close policy | RTL |
| Search missing resource | FsService/Open | visible open error | user retry through source | action error | Bun/RTL |
| Start missing entry | FsService tree | current list refresh/error | accepted refresh only | alert | Bun/RTL |
| Start launch failure | canonical opener | action error; no fake process | user retry | alert/flyout | Bun/RTL |
| Start inaccessible folder | FsService | folder error, trail remains coherent | accepted retry | alert/back | Bun/RTL |
| taskbar stale Process/Window | Process/Windowing | no active false state; refresh projection | subscription refresh | no invented close | Bun/RTL |
| taskbar close veto/defer | Process close negotiation | menu action leaves window/process; deferred prompt remains | app decides | app close prompt | Bun/RTL |
| taskbar missing presentation | Visual/app registry | deterministic fallback icon/title | no network storm | remains usable | RTL/browser health |
| NativeWindow stale window | WindowManager | adapter no-op/restores authoritative state | no retry | surface unmount | Bun/RTL |
| NativeWindow pointer cancel | browser + manager | restore authoritative geometry, cleanup | next gesture | none | Playwright |
| Monaco worker failure | package/browser | explicit host error, no fake readiness | no automatic retry unless accepted | app policy | Playwright/RTL |
| Monaco model creation failure | Monaco host | editor error, document session independent | explicit retry only | close app | Bun/RTL |
| Monaco language unavailable | canonical #178 hint/Monaco | safe documented fallback | no classifier guess | retain document | Bun/RTL |
| FileManager stale resource | FsService/NodeId | refresh/error, no operation on wrong node | Refresh command | ErrorBanner | Bun/RTL |
| FileManager command failure | command authority | visible error; partial result reflected after refresh | explicit user retry | ErrorBanner | Bun/RTL |

No retry behavior is invented by this matrix. Each row requires the accepted
production authority's actual retry/dismissal vocabulary.
