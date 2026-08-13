# Native-app stale/deleted resource matrix

| state | Text/Markdown | Photos/Video | js-dos/EmulatorJS | expected |
|---|---|---|---|---|
| target missing before read | session error | source error | startup alert | no fake ready |
| delete while open | next read/save error/conflict | old object URL until change/close, then error | runtime continues only over already-loaded bytes; close policy | explicit result |
| Trash move | stable NodeId but protected/open policy | same | #64 identity policy | no path replacement |
| restore | same NodeId can reopen | reopen through OpenService | save association remains candidate | deterministic |
| permanent delete | stat/read fails | error/cleanup | no new target | explicit alert |
| stale NodeId | no save to another resource | no hidden fallback | startup error | close remains safe |

Current deterministic FS tests prove NodeId/Trash behavior. App-level mounted
state and browser cleanup remain RED promotion gaps, not invented semantics.
