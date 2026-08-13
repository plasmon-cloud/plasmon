import type { NodeId } from "../contracts/index.ts";

export type SpatialDirection = "up" | "right" | "down" | "left";
export interface SpatialRect { left: number; top: number; right: number; bottom: number }

function center(rect: SpatialRect) {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 };
}

export function spatialNeighborId(
  orderedIds: readonly NodeId[],
  currentId: NodeId,
  direction: SpatialDirection,
  rectangles: ReadonlyMap<NodeId, SpatialRect>,
): NodeId | null {
  const currentRect = rectangles.get(currentId);
  if (!currentRect) return null;
  const current = center(currentRect);
  let best: { id: NodeId; score: number; order: number } | null = null;

  for (let order = 0; order < orderedIds.length; order += 1) {
    const id = orderedIds[order]!;
    if (id === currentId) continue;
    const rect = rectangles.get(id);
    if (!rect) continue;
    const candidate = center(rect);
    const dx = candidate.x - current.x;
    const dy = candidate.y - current.y;
    let primary = 0;
    let secondary = 0;
    if (direction === "right") { if (dx <= 1) continue; primary = dx; secondary = Math.abs(dy); }
    else if (direction === "left") { if (dx >= -1) continue; primary = -dx; secondary = Math.abs(dy); }
    else if (direction === "down") { if (dy <= 1) continue; primary = dy; secondary = Math.abs(dx); }
    else { if (dy >= -1) continue; primary = -dy; secondary = Math.abs(dx); }

    const score = primary + secondary * 4;
    if (!best || score < best.score || (score === best.score && order < best.order)) best = { id, score, order };
  }

  return best?.id ?? null;
}
