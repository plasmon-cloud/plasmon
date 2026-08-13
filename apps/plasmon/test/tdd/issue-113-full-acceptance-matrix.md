# #113 full acceptance matrix

| criterion | current actual | evidence | final gate |
|---|---|---|---|
| filename-aware title/identity | Text sets `snapshot.name || Text Editor`, not accepted `filename - Monaco Editor` | source + package e2e opens title | deterministic/RTL RED |
| visible language mode | language passed to Monaco but no visible language indicator | editorModel test only | RTL RED |
| line/cursor/status | footer exposes UTF-8/Ln/Col/Modified | source + cursor model | RTL characterization |
| minimap/text preview | Monaco sets `minimap.enabled:false` | source | packaged/browser RED |
| discoverable Find/Replace/Go to Line/wrap/minimap | no command UI | source | RTL RED; Monaco interaction browser |
| supported source mapping | classifier/editor model current mapping | tests | #178 dependency |
| save/reopen/conflict | session/package e2e | existing | preserve, not duplicate |
| loading/error/empty | status/alert surfaces | source | RTL |
| narrow window | min width/window constraints | definitions | browser/manual |
| focus/keyboard/Ctrl+S/context | keydown capture and Monaco | source/package edit | RTL/browser |

Disposition: **VERIFIED FULL RED PACKET** for deterministic missing chrome and
**criterion-specific browser boundary** for Monaco minimap/command/rendering.
Exact component/CSS structure remains unspecified.
