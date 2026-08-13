# Resource identity mutation corpus

| app | mutation | required result | current evidence/gap |
|---|---|---|---|
| Text/Markdown | rename while clean/dirty | same NodeId/session; title updates; save remains target | `checkExternalChange` handles name; explicit test gap |
| Text/Markdown | move | same NodeId/save target | FS identity tests; app integration gap |
| Photos | rename/move | source remains current or explicit reload policy | component target effect; browser gap |
| Video | rename/move | object URL/session not silently replaced | source effect; browser gap |
| Browser shortcut | move/rename | URL target is resource identity/content | URL tests; browser gap |
| runtime game | rename/move | future #64 save stays NodeId-bound | #64 packet |
| Review projection | path changes are Kernel/Review-owned | no fake Plasmon process | Review integration |

No live document may silently bind to a new path after stale NodeId failure.
