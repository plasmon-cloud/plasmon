import type {
  Dispatch,
  KeyboardEvent as ReactKeyboardEvent,
  SetStateAction,
} from "react";
import type { FsNode, NodeId } from "../contracts/index.ts";
import { fileManagerKeyboardCommand, isEditingKeyboardTarget } from "./keyboard.ts";
import {
  clearSelection,
  selectAll,
  selectNode,
  type RectLike,
  type SelectionState,
} from "./model.ts";
import type { FileManagerPresentation } from "./render-state.ts";
import { nextFileManagerViewId } from "./view-strategy.ts";

interface UseFileManagerKeyboardAdapterOptions {
  nodes: readonly FsNode[];
  orderedIds: readonly NodeId[];
  selection: SelectionState;
  presentation: FileManagerPresentation;
  renameActive: boolean;
  overlayOpen: boolean;
  entryRectangles: () => ReadonlyMap<NodeId, RectLike>;
  setSelection: Dispatch<SetStateAction<SelectionState>>;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRename: (node: FsNode) => void;
  onOpen: (node: FsNode) => void;
  onCancelRename: () => void;
  onCloseOverlays: () => void;
}

function arrowDirection(key: string): "up" | "right" | "down" | "left" | null {
  if (key === "ArrowUp") return "up";
  if (key === "ArrowRight") return "right";
  if (key === "ArrowDown") return "down";
  if (key === "ArrowLeft") return "left";
  return null;
}

export function useFileManagerKeyboardAdapter(
  options: UseFileManagerKeyboardAdapterOptions,
) {
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (isEditingKeyboardTarget(event.target)) return;
    const commandModifier = event.ctrlKey || event.metaKey;
    const command = fileManagerKeyboardCommand(event.key, commandModifier);

    if (command) {
      event.preventDefault();
      if (command === "selectAll") options.setSelection(selectAll(options.orderedIds));
      else if (command === "copy") options.onCopy();
      else if (command === "cut") options.onCut();
      else if (command === "paste") options.onPaste();
      else if (command === "delete") options.onDelete();
      else if (command === "rename") {
        const id = options.selection.focus
          ?? options.selection.ids.values().next().value as NodeId | undefined;
        const node = id ? options.nodes.find((entry) => entry.id === id) : undefined;
        if (node) options.onRename(node);
      }
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const id = options.selection.focus
        ?? options.selection.ids.values().next().value as NodeId | undefined;
      const node = id ? options.nodes.find((entry) => entry.id === id) : undefined;
      if (node) options.onOpen(node);
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (options.renameActive) options.onCancelRename();
      else if (options.overlayOpen) options.onCloseOverlays();
      else options.setSelection(clearSelection());
      return;
    }

    const direction = arrowDirection(event.key);
    if (!direction || options.orderedIds.length === 0) return;

    event.preventDefault();
    const currentId = options.selection.focus ?? options.orderedIds[0] ?? null;
    if (!currentId) return;

    const nextId = nextFileManagerViewId({
      presentation: options.presentation,
      orderedIds: options.orderedIds,
      currentId,
      direction,
      rectangles: options.entryRectangles(),
    });

    if (nextId) {
      options.setSelection(selectNode(
        options.selection,
        options.orderedIds,
        nextId,
        { range: event.shiftKey, additive: commandModifier },
      ));
    }
  };

  return { handleKeyDown };
}
