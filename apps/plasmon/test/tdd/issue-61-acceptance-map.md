# #61 criterion-level characterization closure

| criterion | authority / observable | permanent destination | evidence / final disposition |
|---|---|---|---|
| deterministic overlay state below React | active flyout, Start/Search switch, dismissal | future `src/os/shell/overlayController.test.ts` | current helper + RTL characterization prove behavior; controller does not exist |
| adapters invoke same transitions | Start/Search buttons, Ctrl+Space, Escape, outside click | future Shell controller RTL adapter test | `.red/issue-61.characterization.ui.test.tsx` exercises current adapter and passes |
| opening remains external | canonical dispatcher/Process/Neutron calls | existing activation/headless tests | proven |
| no parallel React-only copy after extraction | ownership/source architecture | #197 refactor guards/manual review | cannot be an honest behavioral RED without inventing API/source shape |
| fast suite/docs | Plasmon fast + Shell docs | ordinary fast suite | current baseline green |

Final disposition: **CHARACTERIZATION READY — COMPLETE BEHAVIOR CORPUS / NO HONEST STRUCTURAL RED**. The unmet architectural extraction is implementation review work. The gate intentionally does not pretend a future controller API exists.
