import type { NodeId } from "../contracts/index.ts";
import { spatialNeighborId, type SpatialDirection } from "./list-layout.ts";
import type { RectLike } from "./model.ts";
import type { FileManagerPresentation } from "./render-state.ts";

export type FileManagerViewKind = "grid" | "list" | "details";
export type FileManagerNavigationPolicy = "linear" | "spatial";

export interface FileManagerViewStrategy {
  kind: FileManagerViewKind;
  entryPresentation: FileManagerViewKind;
  navigation: FileManagerNavigationPolicy;
  detailsColumns: readonly ["Name", "Type", "Size", "Modified"] | null;
}

const GRID_STRATEGY: FileManagerViewStrategy = {
  kind: "grid",
  entryPresentation: "grid",
  navigation: "spatial",
  detailsColumns: null,
};

const LIST_STRATEGY: FileManagerViewStrategy = {
  kind: "list",
  entryPresentation: "list",
  navigation: "spatial",
  detailsColumns: null,
};

const DETAILS_STRATEGY: FileManagerViewStrategy = {
  kind: "details",
  entryPresentation: "details",
  navigation: "linear",
  detailsColumns: ["Name", "Type", "Size", "Modified"],
};

export function fileManagerViewStrategy(
  presentation: FileManagerPresentation,
): FileManagerViewStrategy | null {
  if (presentation === "desktop") return null;
  if (presentation === "list") return LIST_STRATEGY;
  if (presentation === "details") return DETAILS_STRATEGY;
  return GRID_STRATEGY;
}

export function nextFileManagerViewId(options: {
  presentation: FileManagerPresentation;
  orderedIds: readonly NodeId[];
  currentId: NodeId;
  direction: SpatialDirection;
  rectangles: ReadonlyMap<NodeId, RectLike>;
}): NodeId | null {
  const strategy = fileManagerViewStrategy(options.presentation);
  if (strategy?.navigation === "spatial") {
    return spatialNeighborId(
      options.orderedIds,
      options.currentId,
      options.direction,
      options.rectangles,
    );
  }

  const index = Math.max(0, options.orderedIds.indexOf(options.currentId));
  const delta = options.direction === "up" || options.direction === "left" ? -1 : 1;
  return options.orderedIds[
    Math.max(0, Math.min(options.orderedIds.length - 1, index + delta))
  ] ?? null;
}
