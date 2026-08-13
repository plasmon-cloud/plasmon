import type { NodeId } from "../contracts/index.ts";

export type FileEntryPresentation = "desktop" | "grid" | "list" | "details";
export interface FileEntryPosition { x: number; y: number }

export interface FileEntryRenderStyle {
  left: number;
  top: number;
}

export interface FileEntryRenderState {
  isRenaming: boolean;
  className: string;
  style: FileEntryRenderStyle | undefined;
  showExpandedName: boolean;
  showCollapsedNameTitle: boolean;
}

export function fileEntryClassName(
  presentation: FileEntryPresentation,
  selected: boolean,
  focused: boolean,
  renaming: boolean,
  dropTarget: boolean,
): string {
  return `fm-entry fm-entry--${presentation}${selected ? " is-selected" : ""}${focused ? " is-focused" : ""}${renaming ? " is-renaming" : ""}${dropTarget ? " is-drop-target" : ""}`;
}

/**
 * Deterministic FileEntry render policy. Resource identity stays NodeId-backed;
 * this helper owns presentation state only and never mutates or opens a node.
 */
export function deriveFileEntryRenderState(options: {
  nodeId: NodeId;
  selected: boolean;
  focused: boolean;
  dropTarget: boolean;
  presentation: FileEntryPresentation;
  position?: FileEntryPosition | undefined;
  renameNodeId: NodeId | null;
}): FileEntryRenderState {
  const isRenaming = options.renameNodeId === options.nodeId;
  const style = options.presentation === "desktop" && options.position
    ? { left: options.position.x, top: options.position.y }
    : undefined;

  return {
    isRenaming,
    className: fileEntryClassName(
      options.presentation,
      options.selected,
      options.focused,
      isRenaming,
      options.dropTarget,
    ),
    style,
    showExpandedName: options.presentation === "desktop" && (options.selected || options.focused) && !isRenaming,
    showCollapsedNameTitle: !options.selected && !isRenaming,
  };
}
