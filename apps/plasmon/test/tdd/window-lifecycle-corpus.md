# Native window / process lifecycle corpus

| journey | Process authority | Window authority | taskbar projection | dirty-close / stale behavior | evidence |
|---|---|---|---|---|---|
| open first native app | `open` creates starting→running record | `create` allocates identity, focuses | pinned-only/active depending pin | startup failure cleans both | `process.test.ts`, #81 gate |
| open second multi-instance app | distinct ProcessId | distinct WindowId, newest focused | first running, second active | no target singleton inferred | process tests, #81 |
| singleton reopen | same ProcessId | same WindowId focused/restored | active | latest target wins | process tests |
| focus background | Process.focus | Window.focus raises z/MRU | active swaps | no Shell focus copy | manager/model tests |
| minimize focused | Process unchanged | Window minimized, fallback focus | running inactive | MRU retained | mru tests |
| restore/focus minimized | Process unchanged | Window visible, promoted | active | no new process | manager tests |
| maximize/restore | Process unchanged | maximize with restoreGeometry | active | snap sequence preserved | manager/snap tests |
| snap/unsnap | Process unchanged | snap side + floating restoreGeometry | active | browser pointer continuity pending | snap tests/#43 spec |
| ordinary close clean | Process.close allow | Window.close then record removed | disappears or pinned-only | immediate | process tests |
| ordinary close dirty | Process close handler defer/prevent | Window remains; prompt app-local | remains running | save/discard/cancel model | documentClose tests + packaged #42 |
| direct external window close | WindowManager close | window disappears | Process reconciles away | no orphan task | process tests/#81 |
| failed startup | Process removes record | allocated failed window cleaned | no ghost task | retry receives fresh identity | process tests |
| close while Shell menu open | Shell menu action should call Process.close | Window only after accepted lifecycle | projection reconciles | #183 RED |
| Show Desktop | future command | affected windows min; processes remain | tasks remain | close/new-window race defined in #185 | #185 RED/spec |
| placement reopen | future durable record | manager validates/clamps | task identity unchanged | stale/corrupt fallback | #117 RED |

## Identity invariant

`ProcessId`, `WindowId`, app/handler identity, filesystem `NodeId`, and pin identity cannot be substituted. Any permanent regression should assert at least two identities in multi-instance cases to prevent accidental grouping from hiding lifecycle defects.
