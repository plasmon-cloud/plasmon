import type { FsNode, NodeId } from "../contracts/index.ts";

export interface DesktopPosition { x: number; y: number }
export type DesktopPositions = Record<NodeId, DesktopPosition>;

const GRID_ORIGIN_X = 16;
const GRID_ORIGIN_Y = 16;
const GRID_STEP_X = 104;
const GRID_STEP_Y = 104;
const GRID_ROWS = 6;
const ENTRY_WIDTH = 92;
const ENTRY_HEIGHT = 88;

export function defaultDesktopPosition(index: number): DesktopPosition {
  return {
    x: GRID_ORIGIN_X + Math.floor(index / GRID_ROWS) * GRID_STEP_X,
    y: GRID_ORIGIN_Y + (index % GRID_ROWS) * GRID_STEP_Y,
  };
}

function overlaps(a: DesktopPosition, b: DesktopPosition): boolean {
  return a.x < b.x + ENTRY_WIDTH && a.x + ENTRY_WIDTH > b.x && a.y < b.y + ENTRY_HEIGHT && a.y + ENTRY_HEIGHT > b.y;
}

export function allocateDesktopPositions(
  current: Readonly<DesktopPositions>,
  orderedNodes: readonly FsNode[],
): DesktopPositions {
  const next: DesktopPositions = { ...current };
  const activeIds = new Set(orderedNodes.map((node) => node.id));
  const occupied = Object.entries(current)
    .filter(([id]) => activeIds.has(id))
    .map(([, point]) => point);

  for (const node of orderedNodes) {
    if (next[node.id]) continue;
    for (let slot = 0; slot < Number.MAX_SAFE_INTEGER; slot += 1) {
      const candidate = defaultDesktopPosition(slot);
      if (occupied.some((point) => overlaps(point, candidate))) continue;
      next[node.id] = candidate;
      occupied.push(candidate);
      break;
    }
  }
  return next;
}

export function hasDesktopPositionsForNodes(
  current: Readonly<DesktopPositions>,
  nodes: readonly FsNode[],
): boolean {
  return nodes.every((node) => current[node.id] !== undefined);
}
