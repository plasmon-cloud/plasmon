# #117 acceptance map

| criterion | authority | observable | layer | current evidence | missing / disposition |
|---|---|---|---|---|---|
| reopen committed normal placement | WindowManager + Fs-backed placement record | same bounded rect after close/recomposition | headless | #117 RED fails: default `(64,48)` returns | production persistence record; HEADLESS RED |
| validate/clamp through manager | WindowManager `constrainGeometry` | stale record never strands titlebar | Bun geometry | current manager constraints green | integrate persistence with manager; incomplete |
| snap/max restore policy | manager snap/restore geometry | saved normal rect survives state transitions | Bun | #43 snap tests prove session policy | persistence composition missing |
| missing/corrupt fallback | placement decoder + manager default | safe default, no crash | Bun | no decoder exists | missing; permanent test destination ledger |
| durable accepted boundary | FsService metadata/prefs, not localStorage | reconstruct over same repository | headless | preference store proves pattern; no placement store | RED gate |
| packaged close/reopen | production package/browser | visible reopened geometry | browser/manual | not run | browser follow-up |

Node, Process, Window, and application identities must stay separate. Do not key durable geometry by transient WindowId alone.
