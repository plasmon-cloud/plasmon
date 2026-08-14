# #198 refactor-specific RED packet

**Status: PACKET READY — HEADLESS + RTL RED inheritance**

Prepared against current `origin/release/0.1.0-r2` (`82f176a`). This packet does not add a second taskbar model or duplicate any accepted gate. It composes the existing #72, #81, #118, #183, and #109 evidence for the implementation of #198.

## Authority fence

| concern | canonical authority | refactor disposition |
|---|---|---|
| native process identity, lifecycle, close negotiation | `ProcessController` / `NativeProcessController` | **PRESERVE**; no taskbar process database |
| native window identity, focus, minimize/restore, z-order | `WindowManager` / `NativeWindowManager` | **PRESERVE**; no Shell focus or lifecycle shadow |
| pins, theme, wallpaper, alignment preference when accepted | `ShellPreferenceStore` / filesystem-backed preferences | **PRESERVE**; alignment persistence is currently **UNSPECIFIED** until #183 defines it |
| taskbar state labels and projection | Shell `deriveTaskbarEntries()` / taskbar presentation model | **PRESERVE** accepted #72 states; **CHANGE** grouping/menu projection where #118/#183 require it |
| application/resource identity | shared Visual/resource presentation, native registry, Element metadata | **PRESERVE**; consume #190's shared seam, do not classify in taskbar |
| DOM menu placement, viewport containment, visual alignment | browser adapter / CSS / Playwright | **CHANGE** only through browser evidence; never infer from headless state |

## Existing executable evidence

| contract | existing gate | current result | packet use |
|---|---|---|---|
| pinned-only/running/active/launching/uncertain task states | `src/os/shell/taskbarPresentation.test.ts`, `shell.test.ts`, #72 map | green | preserve as permanent projection contract |
| composed Process/WindowManager lifecycle | `apps/plasmon/test/taskbarLifecycle.test.ts` | 3 pass, 14 assertions on current r2 | permanent cross-authority guard |
| one app group retains process/window members | `.red/issue-118.red.test.ts` | RED: 2 native entries instead of 1 | implementation RED; do not replace with a taskbar DB |
| running task Close command | `.red/issue-183.red.ui.test.tsx` | RTL RED: only Pin is exposed | implementation RED; route through `ProcessController.close()` |
| background alignment actions | `.red/issue-183.red.alignment.ui.test.tsx` | RTL RED: Center/Left items absent | implementation RED; preference contract remains unspecified until defined |
| pin identity and shared artwork | #109 characterization + Visual tests | green | preserve; #190 is merged in current r2 |
| menu geometry/adjacency | `issue-183-browser-adoption.md` | browser boundary, not locally executed | do not claim from RTL |

Focused RED commands:

```sh
bun test ./apps/plasmon/test/tdd/.red/issue-118.red.test.ts
bun test --preload ./apps/plasmon/test/setupHappyDom.ts \
  ./apps/plasmon/test/tdd/.red/issue-183.red.ui.test.tsx \
  ./apps/plasmon/test/tdd/.red/issue-183.red.alignment.ui.test.tsx
```

Observed current failures are the missing single application group, missing `Close`, and missing Center/Left menu actions. These are the refactor's behavioral adoption gates; no source-shape assertion is required.

## PRESERVE / CHANGE / UNSPECIFIED

### PRESERVE

- one pinned native app entry remains pinned-only before launch;
- Process open/focus and WindowManager minimize/restore remain the only lifecycle transitions;
- unknown Element state remains uncertain;
- closing a process removes running state while preserving a pin;
- taskbar accessibility state labels and shared resource identity;
- #72 and #81 permanent guards remain green throughout reconstruction.

### CHANGE

- taskbar projection supports one deterministic application group with exact member process/window targets;
- selecting a group member delegates focus/restore to Process/Windowing;
- Close delegates through Process close negotiation, including dirty veto/defer;
- background/item context commands expose the accepted #183 actions;
- old duplicate taskbar/running-state paths are removed after migration.

### UNSPECIFIED — do not guess

- chooser visual layout and exact grouping affordance;
- taskbar alignment persistence schema and default until #183's owner is accepted;
- Show Desktop and TaskManager behavior (#184/#185);
- CSS class names, React component boundaries, and internal controller names.

## Promotion / completion gates

1. Keep #72 and `test/taskbarLifecycle.test.ts` green.
2. Turn #118 and #183 REDs green without weakening identity, veto, or authority assertions.
3. Add permanent pure grouping/menu-policy coverage at the owning Shell model seam; add RTL only for semantic adapter actions.
4. Use Playwright only for #183 source-adjacent menu placement and real viewport containment.
5. Run `npm --workspace neutron-plasmon test`; run packaged refactor smoke only for the browser geometry claim.
6. Remove superseded taskbar state/helpers before Ready; no second Process/WindowManager/taskbar running database is acceptable.

**Dependency assessment:** packet is ready. #197 Shell decomposition, #190 shared presentation, and #187 guard infrastructure are ordering inputs, not reasons to invent a duplicate gate. #90/#174 Search identity and #184/#185 remain outside this packet.
