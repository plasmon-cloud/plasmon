# Luna-C packaged-browser execution plan v2

All plans consume the existing manifest-driven `plasmon-local.ndeploy.json`,
`npm run plasmon:demo:prepare`, local Neutron runtime, and installed package
paths. No direct component mount is final evidence. Local browser execution is
blocked when `local.ndeploy.session.json` is absent; CI/authorized environment
runs these plans.

| Issue | fixture/setup | journey/instrumentation | expected current RED | future GREEN/artifact |
|---|---|---|---|---|
| #58 | Review package manifest | standalone Kernel tile -> create/edit/history/import/export/reload; strict errors | install/evidence not locally run | trace + screenshots + e2e pass |
| #67/#89 | Text/Markdown new docs | instrument Worker constructor/request/message; edit/save/reopen; Chromium+Firefox | worker path/security allowance | Worker URL/handshake log, no errors |
| #113/#114 | new Text/Markdown docs | semantic controls/status/formatter/preview/narrow | missing commands/title/formatter | RTL + packaged artifacts |
| #121 | `plasmon-fixture=demo-game` | `/Games` -> FileManager -> js-dos -> real ready/canvas | final installed path unverified | health ledger + runtime trace |
| #180 | explicit image fixture #181/test setup | open via canonical FS; denied fullscreen; expand/restore geometry | local browser boundary unavailable | bounds/screenshot + no pageerror |
| #202 | explicit js-dos fixture | real player readiness and strict console/request collection | exact storage errors | no two #202 messages, allowances removed |
| #48 | legal generated NES | open `.nes`; host/core/WASM ready; close teardown | installed rerun | phase trace + no external requests |
| #64 | legal js-dos save-capable bundle | progress export -> close -> reopen/restore | adapter absent | save artifact + restore trace |
| #94/#107 | tiny legal media fixture | FileManager thumbnail/player decode/error | codec/browser boundary | frame/codec artifact |
| #96/#112/#170 | installed package/Review | Start/Search/taskbar/content chrome/Review themes | visual/manual remainder | bounded screenshots + semantic checks |

Strict baseline allows only exact unrelated #187 reasons. Each specialist gate
removes only its own allowance after owner integration; screenshots are bounded
state evidence, not broad visual regression.
