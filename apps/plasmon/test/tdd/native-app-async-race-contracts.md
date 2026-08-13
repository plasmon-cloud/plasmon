# Native-app async race contracts

| race | current guard | expected result | evidence/gap |
|---|---|---|---|
| Text target A -> B before read | DocumentSession generation | A cannot overwrite B | document test target switching |
| Text save after target change | generation/nodeId check | no stale write/state | source; test gap |
| Text external poll after dispose | disposed guard | no state update | source |
| Photos decode after target change | `active` cleanup + lease release | old source not retained | source; browser gap |
| Video resolve after target change | active/cleanup | old URL released | source; browser gap |
| js-dos start after close | disposed guard/player cleanup | no ready state/leak | source; browser gap |
| EmulatorJS message after close | disposed/token/source check | ignored; frame removed | source; browser gap |
| Monaco import after unmount | cancelled flag | no editor/model | source |
| Review concurrent commands | per-Atom write queue + expectedRevision | one commits, one conflict | engine test |

No current deterministic stale-result defect was reproduced in source tests. The
browser rows remain lifecycle promotion gaps, not reasons to fake readiness.
