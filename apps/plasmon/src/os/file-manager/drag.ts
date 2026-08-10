import type { NodeId } from "../contracts/index.ts";
import type { SelectionState } from "./model.ts";

export interface EntryDragGestureState {
  readonly ids: readonly NodeId[];
  readonly moved: boolean;
  readonly releaseSelection: SelectionState | null;
}

export interface EntryDragCompletion {
  readonly shouldDrop: boolean;
  readonly ids: readonly NodeId[];
  readonly selection: SelectionState;
}

/**
 * Resolves drag-vs-click without performing any filesystem/UI side effects.
 * Pointer cancellation is never a successful drop and preserves current selection.
 */
export function finishEntryDragGesture(
  gesture: EntryDragGestureState,
  currentSelection: SelectionState,
  cancelled: boolean,
): EntryDragCompletion {
  if (cancelled) {
    return { shouldDrop: false, ids: [], selection: currentSelection };
  }
  if (!gesture.moved) {
    return {
      shouldDrop: false,
      ids: [],
      selection: gesture.releaseSelection ?? currentSelection,
    };
  }
  return {
    shouldDrop: true,
    ids: [...gesture.ids],
    selection: currentSelection,
  };
}
