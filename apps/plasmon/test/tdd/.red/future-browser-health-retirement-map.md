# Future browser-health allowance retirement map

Baseline authority: `installPlasmonBrowserHealth` in `test/e2e/plasmon-browser-health.ts`.
Future tests must begin with the accepted strict baseline and add only allowances
owned by their issue.

| Allowance/pattern | Current surface | Canonical Issue | Expected retirement | Danger |
|---|---|---|---|---|
| `/static/plasmon/icons/` ORB/aborted requests | packaged Plasmon assets | #190 | #190 asset path integration and strict health rerun | removing early hides real presentation defect |
| Monaco worker fallback warning | Text/Markdown | #67/#200 | #67/#200 worker host/package acceptance | unrelated to Search/Start/taskbar |
| opaque-origin `origin null` worker warning | Text/Markdown sandbox | #67/#200 | worker boundary fixed without weakening sandbox | do not remove sandbox |
| iframe sandbox warning | Kernel-owned installed app sibling | #187 baseline | unrelated to future surface unless ownership changes | foreign Neutron boundary |
| js-dos StorageManager errors | js-dos runtime | #202 | #202 only | do not widen for Plasmon refactors |
| js-dos audio/GPU diagnostics | js-dos runtime | #202/browser environment | retire with runtime proof | scoped URL/pattern required |
| Monaco cancellation pageerror | editor teardown | #67/#200 | only after stable lifecycle evidence | broad `Canceled` allowance dangerous |

No new blanket `pageerror`, console, or requestfailed allowance is permitted for
#175/#193/#194/#197/#198/#199/#200. Each packet should document exact pattern,
URL scope, reason, and retirement owner.
