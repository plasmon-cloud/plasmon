# Shell / Process / Window async and cleanup corpus

| race | authoritative expected result | current evidence | promotion destination |
|---|---|---|---|
| Search query A resolves after B | B remains rendered; A ignored | `LatestSearchController` tests | permanent `search.test.ts` |
| Search flyout closes during debounce | timer/AbortController canceled; no stale apply | Shell effect code; no dedicated RTL | RED promotion gap |
| Search filesystem invalidation during active query | one latest rescan; no stale overwrite | invalidation + latest tests | permanent composed Search test |
| Neutron load A after newer load B | generation drops A | Shell `useExternalElements`; bridge tests | promotion gap |
| Neutron refresh fails on visibility/focus | unknown preserved; fallback load attempted | `openExternalElement` test, bridge tests | permanent lifecycle adapter test |
| taskbar native launch busy then process appears | launching clears, running/active derives from snapshots | model busy tests; #81 composition | permanent #81 promotion |
| taskbar Element open fails | busy clears, action error visible, uncertainty not strengthened | Shell callback code; no dedicated RTL | promotion gap |
| preference save failure | in-memory change remains, notice visible, later writes work | `preferencesFs.test.ts` | permanent Shell RTL notice gap |
| Start reconciliation rejects | error visible, no render loop | Shell effect code; migration tests | promotion gap |
| Start folder list resolves after flyout changes | stale result ignored by active flag | Shell effect code; no focused test | promotion gap |
| close request deferred then unmount | Process request canceled, no teardown resurrection | `documentClose.test.ts` | permanent browser prompt lifecycle |
| close Save resolves after cancel/dispose | stale request cannot complete | DocumentCloseModel guards request identity | permanent model |
| Window pointer cancel/lost capture | interaction cleanup restores iframe pointer events, selection, cursor, capture | `interaction.ts` helpers; no browser gate executed | #199 browser adoption |
| Window viewport resize during drag | manager remains geometry authority; final commit constrained | manager/interaction code | #199 browser adoption |
| process startup throws after window allocation | only owned failed window cleaned | process tests | permanent process suite |
| external window closes during taskbar projection | Process reconciles before next projection | #81 gate | #81 permanent promotion |

## Cleanup requirements

Every browser adoption must assert no unexpected page errors, no leaked pointer capture, restored document selection/cursor, restored iframe pointer-events, removed timers/listeners, and no stale taskbar/search target after unmount or close.
