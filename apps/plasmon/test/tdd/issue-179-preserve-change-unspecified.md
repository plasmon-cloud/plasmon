# #179 preserve / change / unspecified

## Preserve

- FsService and stable NodeId identity;
- shared DocumentSession for Text and Markdown;
- explicit successful-save dirty transition;
- conflict detection and error retention;
- Process close negotiation from #41/#42;
- Save/Discard/Cancel semantics, including discard suppressing dispose flush;
- Monaco model/cursor/undo ownership;
- no foreground localStorage for durable preference.

## Change

- fresh/default autosave is OFF;
- edits remain dirty and bytes remain unchanged after the old debounce interval;
- an accepted shared preference can opt into bounded autosave;
- preference persistence, if in scope, uses accepted Plasmon settings authority.

## Unspecified

Exact settings screen location, debounce duration, preference serialization,
React component names, Monaco API details, and visual labels are not accepted by
this issue unless a canonical UI criterion adds them. The initial RED reproduces
forced current timer behavior through DocumentSession alone for both Text and
Markdown; it does not presuppose a new settings seam.
