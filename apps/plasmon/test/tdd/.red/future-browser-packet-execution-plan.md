# Future browser packet execution plan

Current execution block: local `local.ndeploy.session.json` is absent. This is
operational, not a harness gap. Do not reinstall merely to make Luna green.

| Spec | Package requirements | Fixture requirements | Existing CI/lane | Intentional expected result | Health allowances | Artifact |
|---|---|---|---|---|---|---|
| #175 Search geometry | installed Plasmon + Kernel launcher | Apps/Documents/Media/Atoms sparse and populated corpus | Plasmon packaged specialist/smoke lane | current geometry may RED until stable frame | strict #187; no new allowance | measured rect JSON + trace |
| #66 drag preview | installed Plasmon | multi-select/window overlap/drop target | Plasmon specialist | product stack/hit/drop RED if current | own accepted baseline | screenshot/trace |
| #86 selection | installed Plasmon | diagnostic text and entries | Plasmon specialist | browser text-selection boundary | strict | trace + selection evidence |
| #93 thumbnail | installed Plasmon | portrait/landscape/square image resources | Plasmon specialist | visual containment only | media-specific accepted | screenshots/rects |
| #95 selected label | installed Plasmon | selected desktop resource/rename distinction | Plasmon specialist | overlay geometry boundary | strict | rect/trace |
| #110 hidden preference | installed Plasmon | filesystem hidden + preference persistence | Plasmon specialist | packaged persistence journey | strict | before/after screenshots |
| #173 List | installed Plasmon | enough entries for columns/spatial ArrowRight | Plasmon specialist | current List likely RED | strict | rect/keyboard trace |
| #190 presentation | installed package | resolved shared asset requests | Plasmon health lane | asset request RED until PR | #190 only + accepted unrelated | request log/trace |
| #67/#200 Monaco | installed package + worker assets | Text/Markdown normal FS fixtures | specialist Monaco packaged lane | worker/editor RED until fixes | exact worker allowances only | worker URL/console/trace |
| #177/#43/#199 | packaged native windows | repeated windows/edge snap/resize | future windowing specialist | pointer/geometry RED as accepted | strict | rect/pointer trace |
| #183/#198 | packaged Shell/taskbar | running native app/window + preference | future Shell specialist | menu/group/alignment RED | strict | source/menu rects |

All specs must use normal production paths and the existing launcher/frame
harness. Parsing/listing is syntax validation only, never execution evidence.
