# r2 presentation authority/import map

This is a source-inspection map, not an enforcement rule.

| Authority | Permitted consumers | Actual examples | Suspicion/constraint |
|---|---|---|---|
| FsService / NodeId | models, commands, projections, sessions | FileManager, Shell Search/Start, Text DocumentSession | UI must not replace identity |
| Resource classification | Search/FileManager/Properties/Visual | `classifyResource` imports in Search and FileManager policy | ordinary suffix classifiers are duplicate candidates |
| Visual | all resource/application surfaces | `os/visual` assets/presentation/primitives | no per-surface icon authority after #190 |
| AssociationRegistry/OpenService | opening/Open With/Properties | `os/integration`, `shell/activation`, FileManager properties | no Visual/editor decision may open directly |
| Trash | delete/FileManager | delete helper + Trash authority | no local permanent delete |
| Process | native lifecycle/taskbar/editor close | Shell model, Text close protection | no second running registry |
| Windowing | geometry/focus/z/minimize | NativeWindow, WindowLayer, taskbar projection | no Shell/React geometry authority |
| NativeApplicationRegistry | definitions/metadata/seed inputs | Shell + Start/Search | not durable Start inventory |
| Shell transient coordination | flyout/dismissal/context | Shell interactions | must not absorb foreign Browser/Neutron events |
| Start filesystem | durable Start tree/reconciliation | `startMenu.ts` | no hard-coded app catalog |
| Search result model | Search projection/cancellation/limits | `search.ts` | #193 consumes accepted #174/#189 result vocabulary |
| FileManager commands | view adapters | model/helpers/activation/clipboard/delete | views invoke, do not duplicate policy |
| Monaco host future | browser runtime/model exact owner | current shared `MonacoEditorSurface` candidate | no document/session authority |

## Actual import flags

- `search.ts` imports `classifyResource` (expected), but also owns
  `MEDIA_EXTENSIONS` (suspicious duplicate after #178).
- `file-icons.ts` imports Fs metadata and owns suffix sets (presentation support,
  but semantic duplication must be retired only after #178/#190 migration).
- Shell imports Search/Start models and activation adapters (expected during
  current architecture; #193/#194 will narrow boundary).
- FileManager imports command helpers and FileEntry (expected; #195 will split
  browser adapters without bypassing authorities).
- Text imports `editorLanguageForName` (future #178 migration candidate).
- NativeWindow imports geometry helpers and manager interfaces (expected thin
  adapter).
- Visual does not import FsService/AssociationRegistry (expected safe direction).
- `gui2`/legacy `platform` imports are outside canonical `os/**`; #25/#26 own
  retirement evidence.

Do not enforce static boundaries until replacement seams and dynamic registration
have been verified.
