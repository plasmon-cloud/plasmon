# Native-app browser-health allowance map

| exact allowance family | issue | owner | retirement gate | remove early? |
|---|---|---|---|---|
| Monaco Worker fallback warning | #67/#200 | Monaco host/path | real Worker creation+communication Chromium/Firefox | yes, it would hide the core RED |
| Monaco opaque-origin warning | #67/#89/#200 | Monaco path | no Firefox SecurityError and healthy worker | yes |
| StorageManager estimate error | #202 | js-dos | runtime ready with no error | no; owner blocked |
| storage-directory SecurityError | #202 | js-dos | no sandbox storage error | no; owner blocked |
| icon ORB/aborted requests | #190 | Visual/package | asset URL correction and strict smoke | unrelated to native app packets |
| js-dos audio/GPU diagnostics | #202/#187 | runtime/browser | focused runtime health decision | do not attach to #67 |
| Kernel iframe sandbox warning | #187 | Kernel boundary | accepted external Kernel evidence | not a Plasmon app fix |

Rules are exact kind/message/path matches and must retain issue-specific reason.
No native-app gate may broaden an allowance or suppress arbitrary console errors.
