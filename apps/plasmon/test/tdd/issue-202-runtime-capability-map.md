# #202 js-dos runtime capability map

| boundary | owner | observed/required |
|---|---|---|
| game bytes | FsService/OpenTarget.nodeId | production filesystem bytes |
| association/open | AssociationRegistry/OpenService | `runtime:js-dos`, no filename dispatch |
| host | `JsDosPlayer.tsx` | real player lifecycle/canvas readiness |
| runtime assets | `runtime.ts` + package | local package mirror; logical `/System/Program Files/js-dos` |
| Worker/WASM/canvas | js-dos/browser | genuine packaged boundary |
| storage estimate | vendored js-dos bootstrap | current `StorageManager.estimate` unsupported error |
| storage directory | browser sandbox | current SecurityError without same-origin |
| security | Neutron sandbox/CSP | immutable for this fix |
| health | #187 ledger | exactly two temporary #202 allowances |

Current host already proves local asset URL construction and reports explicit
loading/error/ready states. It does not make storage errors healthy; canvas
readiness is not storage correctness.
