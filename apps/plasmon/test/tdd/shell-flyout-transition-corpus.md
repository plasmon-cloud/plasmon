# Shell flyout transition corpus

Current production model and RTL evidence, with no second Shell state machine invented.

| current state | event | next state | focus destination | authority / evidence |
|---|---|---|---|---|
| none | Start click | Start | Start search textbox (`autoFocus`) | Shell RTL |
| Start | Start click | none | Start toggle/browser focus | existing adapter |
| none | Search click | Search | Search textbox (`autoFocus`) | RTL |
| Search | Search click | none | Search toggle/browser focus | adapter behavior |
| Start | Ctrl+Space | Search | Search textbox | global Shell key handler; #61 characterization |
| Search | Ctrl+Escape | Start | Start textbox | **UNSPECIFIED/current handler does not define Ctrl+Escape**; avoid claiming |
| any flyout | Escape | none | browser default/source | Shell global key handler |
| any flyout | outside pointer | none | outside target | `shouldDismissShellFlyout` + RTL |
| flyout | pointer inside panel | same | clicked control | dismissal predicate |
| flyout | another toggle | selected other flyout | new panel autofocus/owner | Shell `toggleFlyout` |
| any | context menu on Shell-owned task | context menu | menu first item/browser | `resolveShellContextMenuPolicy` |
| context menu | outside pointer | prior flyout/none | outside target | pointer listener |
| context menu | Escape | none | browser/source | **not separately permanent-tested**; adoption RTL gap |
| Start | directory activation | Start with deeper trail | folder row / existing focus | `startTrail` filesystem navigation |
| Start | file activation success | none | opened native/browser target | canonical dispatcher |
| Search | result activation success | none | opened target | canonical dispatcher |
| Search | activation failure | Search + error | result/input remains | Shell actionError |
| tray | tray click | tray | tray panel | Shell state |
| calendar | clock click | calendar | calendar controls | Shell state |
| settings | footer/context action | settings | theme/wallpaper control | Shell state |
| settings | preference write failure | settings + notice | active control remains | non-destructive preference outcome |

## Explicit gaps

- There is no controller object below React; #61 structural acceptance has no honest source-shape RED. The behavior corpus is adoption-ready for a future controller.
- Ctrl+Escape semantics while Search is open, menu keyboard roving focus, and focus return after outside dismissal are browser/adaptor boundaries needing RTL/Playwright adoption.
- Context-menu source adjacency and viewport containment are #183 browser criteria, not pure model claims.
