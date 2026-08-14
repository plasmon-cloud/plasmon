# #119 criterion-level characterization closure

| criterion | current product / authority | permanent destination | evidence / final disposition |
|---|---|---|---|
| classify native transient vs app-local overlay | DocumentClosePrompt and FileManager Properties/Open With are app-local overlays; NativeWindow is a true top-level window | scoped README + characterization test | `.red/issue-119.characterization.test.tsx`, existing modal tests |
| explicit owner/parent for true native transient | no current true native transient exists | future Windowing contract test only after demonstrated consumer | UNSPECIFIED; do not invent owner field |
| deterministic parent/child focus/z | no parent/child relation to test | future manager test | UNSPECIFIED |
| parent minimize/close/child close | app-local overlays disappear with owning React surface; native Process close is existing authority | packaged #42 and FileManager modal tests | app-local behavior characterized; native transient behavior not applicable |
| modal prevents inappropriate parent activation | app-local `aria-modal` and backdrop event boundary | RTL/browser modal test | existing Open With boundary + packaged dirty-close prompt; focus trapping remains browser adoption gap |
| no generalized multi-window architecture | current Process/Windowing remain unchanged | refactor review / docs | preserved |

Final disposition: **RECON COMPLETE — CURRENT-SURFACE AUDIT / UNSPECIFIED NATIVE TRANSIENT CONTRACT**. Against current r2, the focused characterization passes (1 test, 6 assertions) and confirms the existing dirty-document prompt is app-local. No native transient acceptance can honestly be marked green because the product has no demonstrated native transient, and no test may fabricate one. A future implementor must first select a concrete consumer or explicitly defer the owner contract.
