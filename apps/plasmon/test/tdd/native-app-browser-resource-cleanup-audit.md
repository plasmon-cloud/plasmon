# Native-app browser resource cleanup audit

| resource | owner | cleanup trigger | current evidence | gap |
|---|---|---|---|---|
| Monaco editor/model/disposables | MonacoEditorSurface | model key/unmount | source + model tests | browser repeated open |
| document polling/autosave timer | useDocumentSession/DocumentSession | target/unmount/dispose | session tests | default-off #179 |
| Photos object URL | Photos/media lease | target/unmount | lease test | browser decode/unmount |
| Panzoom/wheel/fullscreen listener | Photos | image change/unmount | source | browser repeated open |
| Video object URL | Video/media lease | source change/unmount | lease test | browser mounted cleanup |
| iframe | Browser/EmulatorJS | target/unmount | source | browser |
| EmulatorJS timers/listener/frame | EmulatorJsPlayer | runtime change/unmount | source timeout/terminate | browser teardown |
| js-dos Blob/player | JsDosPlayer | unmount/stop | source URL revoke | browser repeated launch |
| Review IndexedDB requests | Review background | transaction completion | persistence implementation | installed restart |

Expected cleanup must not suppress startup errors or complete stale state after
unmount. Future browser gates should observe request/frame/listener effects
where browser APIs make that truthful.
