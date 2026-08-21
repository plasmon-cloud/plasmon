import type { FsNode, NodeId } from "../contracts/index.ts";
import type { SelectionState } from "./model.ts";

export type FileManagerPresentation = "desktop" | "grid" | "list" | "details";

export interface DesktopPosition {
  x: number;
  y: number;
}

export interface FileManagerSnapshot {
  nodes: readonly FsNode[];
  selectedIds: ReadonlySet<NodeId>;
}

export interface FileManagerRenderState {
  visibleNodes: readonly FsNode[];
  orderedIds: readonly NodeId[];
  desktopPositions: Readonly<Record<NodeId, DesktopPosition>>;
  snapshot: FileManagerSnapshot;
}

export function deriveFileManagerRenderState(options: {
  nodes: readonly FsNode[];
  selection: SelectionState;
  filterQuery: string;
  presentation: FileManagerPresentation;
  positions?: Readonly<Record<NodeId, DesktopPosition>>;
}): FileManagerRenderState {
  const query = options.filterQuery.trim().toLocaleLowerCase();
  const visibleNodes = query
    ? options.nodes.filter((node) => node.name.toLocaleLowerCase().includes(query))
    : options.nodes;
  const orderedIds = visibleNodes.map((node) => node.id);
  const desktopPositions = options.presentation === "desktop"
    ? options.positions ?? {}
    : {};

  return {
    visibleNodes,
    orderedIds,
    desktopPositions,
    snapshot: {
      nodes: visibleNodes,
      selectedIds: options.selection.ids,
    },
  };
}
