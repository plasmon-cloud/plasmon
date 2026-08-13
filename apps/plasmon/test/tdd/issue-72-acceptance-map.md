# #72 complete acceptance evidence

| criterion | permanent evidence | result |
|---|---|---|
| no raw yes/no/unknown in taskbar UI | `src/os/shell/taskbarPresentation.test.ts` checks labels; `model.ts` status labels; RTL accessible task buttons | PASS |
| native pinned/running/active/launching projection | `taskbarPresentation.test.ts` pinned/starting/running/focused/minimized cases | PASS |
| Element uncertainty preserved | same test confirms `uncertain`, `Runtime status unavailable`, `?`, no raw token | PASS |
| launching is transient presentation only | busy-task test confirms badge and no strengthened runtime | PASS |
| launch/focus/minimize unchanged | `shell.test.ts` action tests + RTL composed taskbar journey | PASS |
| focused model tests | dedicated taskbar presentation suite | PASS |
| Shell docs accurate | Shell README/AGENTS authority text | PASS |
| composed production lifecycle | Lane-D #81 gate `issue-81.composed.red.test.ts` passes pinned→launch→focus→minimize→restore→close, unknown Element, dirty veto, stale window | PASS; promotion gap until ordinary discovery |

Final disposition: **ALREADY GREEN — COMPLETE ACCEPTANCE PROVEN**. #118 grouping, #183 context Close/alignment, #184 TaskManager, and #185 Show Desktop are explicitly separate and do not make #72 incomplete.
