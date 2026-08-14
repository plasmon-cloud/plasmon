# #61 criterion-level characterization closure

| criterion | authority / observable | permanent destination | evidence / final disposition |
|---|---|---|---|
| deterministic overlay state below React | active flyout, Start/Search switch, dismissal | future `src/os/shell/overlayController.test.ts` | current helper + RTL characterization prove behavior; controller does not exist |
| adapters invoke same transitions | Start/Search buttons, Ctrl+Space, Escape, outside click | future Shell controller RTL adapter test | `.red/issue-61.characterization.ui.test.tsx` exercises current adapter and passes |
| opening remains external | canonical dispatcher/Process/Neutron calls | existing activation/headless tests | proven |
| no parallel React-only copy after extraction | ownership/source architecture | #197 refactor guards/manual review | cannot be an honest behavioral RED without inventing API/source shape |
| fast suite/docs | Plasmon fast + Shell docs | ordinary fast suite | current baseline green |

Final disposition: **RECON COMPLETE — CURRENT BEHAVIOR CHARACTERIZED / NO HONEST STRUCTURAL RED**. Against current r2, the focused RTL characterization passes (1 test, 14 assertions) with the canonical Happy DOM preload. The unmet extraction is architectural implementation review, not a behavioral defect; this packet intentionally does not invent a future controller API.
