# Games js-dos/EmulatorJS cross-runtime matrix

| behavior | js-dos | EmulatorJS | shared/different | owner/test |
|---|---|---|---|---|
| discovery/classification | `.jsdos` | `.nes` currently | distinct associations | #83/D + tests |
| open/process/window | OpenService/runtime host | same | shared authority | headless tests |
| assets | JS/CSS/WASM/emulator | host/loader/CSS/core/WASM | transport pattern shared | #121/#48 package |
| loading/ready | Dos global/events/canvas | child EJS callbacks/canvas | lifecycle differs | browser |
| input/audio | runtime engine | iframe engine | different APIs | browser/manual |
| fullscreen/expand | engine optional | engine optional | browser boundary | future |
| save | #64 absent bridge | NES proof intentionally no save | deliberately different/unknown | #64/future |
| screenshot | #124 future | #124 future | only after save/design | #124 |
| teardown | player.stop + Blob revoke | terminate postMessage + frame remove | similar goal/different protocol | browser gap |
| errors/storage | #202 storage + audio/GPU | masked local storage/wake lock | deliberately different | #202/#48 |

No generic emulator save framework is justified: save APIs and lifecycle are not
proven duplicate yet.
