import type { NodeId } from "../contracts/index.ts";

export interface DesktopPosition { x: number; y: number }
export type DesktopPositions = Record<NodeId, DesktopPosition>;
export interface DesktopWorkspace { width: number; height: number }

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
  return a.x < b.x + ENTRY_WIDTH
    && a.x + ENTRY_WIDTH > b.x
    && a.y < b.y + ENTRY_HEIGHT
    && a.y + ENTRY_HEIGHT > b.y;
}

function workspaceLimits(workspace?: DesktopWorkspace): { maxX: number; maxY: number } {
  if (!workspace) return { maxX: Number.POSITIVE_INFINITY, maxY: Number.POSITIVE_INFINITY };
  const width = Number.isFinite(workspace.width) ? Math.max(0, workspace.width) : 0;
  const height = Number.isFinite(workspace.height) ? Math.max(0, workspace.height) : 0;
  return {
    maxX: Math.max(0, width - ENTRY_WIDTH),
    maxY: Math.max(0, height - ENTRY_HEIGHT),
  };
}

export function isDesktopPositionValid(
  position: DesktopPosition | undefined,
  workspace?: DesktopWorkspace,
): position is DesktopPosition {
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return false;
  const { maxX, maxY } = workspaceLimits(workspace);
  return position.x >= 0 && position.y >= 0 && position.x <= maxX && position.y <= maxY;
}

function clampDesktopPosition(position: DesktopPosition, workspace: DesktopWorkspace): DesktopPosition {
  const { maxX, maxY } = workspaceLimits(workspace);
  return {
    x: Math.max(0, Math.min(maxX, position.x)),
    y: Math.max(0, Math.min(maxY, position.y)),
  };
}

function firstFreeDesktopPosition(
  occupied: readonly DesktopPosition[],
  workspace?: DesktopWorkspace,
): DesktopPosition | null {
  const { maxX, maxY } = workspaceLimits(workspace);
  const rows: number[] = [];
  for (let row = 0; row < GRID_ROWS; row += 1) {
    const y = GRID_ORIGIN_Y + row * GRID_STEP_Y;
    if (y <= maxY) rows.push(y);
  }
  if (rows.length === 0) rows.push(0);

  const firstX = GRID_ORIGIN_X <= maxX ? GRID_ORIGIN_X : 0;
  const columnCount = Number.isFinite(maxX)
    ? Math.max(1, Math.floor((maxX - firstX) / GRID_STEP_X) + 1)
    : Number.MAX_SAFE_INTEGER;

  for (let column = 0; column < columnCount; column += 1) {
    const x = firstX + column * GRID_STEP_X;
    if (x > maxX) break;
    for (const y of rows) {
      const candidate = { x, y };
      if (!occupied.some((point) => overlaps(point, candidate))) return candidate;
    }
  }
  return null;
}

function placementPriority(
  orderedIds: readonly NodeId[],
  incumbentIds: readonly NodeId[],
): NodeId[] {
  const active = new Set(orderedIds);
  const seen = new Set<NodeId>();
  const prioritized: NodeId[] = [];
  for (const id of incumbentIds) {
    if (!active.has(id) || seen.has(id)) continue;
    seen.add(id);
    prioritized.push(id);
  }
  for (const id of orderedIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    prioritized.push(id);
  }
  return prioritized;
}

/**
 * Canonical deterministic Desktop placement policy.
 *
 * Inputs are deliberately limited to stable NodeIds, persisted/occupied visual
 * positions, and usable workspace geometry. `incumbentIds` identifies NodeIds
 * that were already visible before the current recomposition so a newly
 * visible/restored entry cannot steal an occupied user position merely because
 * display sorting places it first. Filesystem existence, Trash semantics,
 * resource presentation, opening and pointer/drop policy do not belong here.
 */
export function reconcileDesktopPositions(
  current: Readonly<DesktopPositions>,
  orderedIds: readonly NodeId[],
  workspace?: DesktopWorkspace,
  incumbentIds: readonly NodeId[] = [],
): DesktopPositions {
  const next: DesktopPositions = { ...current };
  const occupied: DesktopPosition[] = [];
  const priorityIds = placementPriority(orderedIds, incumbentIds);

  for (let index = 0; index < priorityIds.length; index += 1) {
    const id = priorityIds[index]!;
    const persisted = current[id];
    if (isDesktopPositionValid(persisted, workspace)
      && !occupied.some((point) => overlaps(point, persisted))) {
      next[id] = persisted;
      occupied.push(persisted);
      continue;
    }

    const free = firstFreeDesktopPosition(occupied, workspace);
    if (free) {
      next[id] = free;
      occupied.push(free);
      continue;
    }

    // A workspace may be too small to contain another non-overlapping entry.
    // The Issue does not invent overflow semantics; keep the result bounded and
    // deterministic while preserving the free-slot guarantee whenever one is
    // available.
    const fallback = persisted && Number.isFinite(persisted.x) && Number.isFinite(persisted.y)
      ? persisted
      : defaultDesktopPosition(index);
    const bounded = workspace ? clampDesktopPosition(fallback, workspace) : {
      x: Math.max(0, fallback.x),
      y: Math.max(0, fallback.y),
    };
    next[id] = bounded;
    occupied.push(bounded);
  }

  return next;
}

/**
 * Legacy resource-shaped caller adapter. Placement still consumes only stable
 * NodeIds and delegates all policy to `reconcileDesktopPositions`.
 */
export function allocateDesktopPositions(
  current: Readonly<DesktopPositions>,
  orderedNodes: readonly { id: NodeId }[],
  workspace?: DesktopWorkspace,
): DesktopPositions {
  return reconcileDesktopPositions(current, orderedNodes.map((node) => node.id), workspace);
}

export function desktopPositionsEqual(
  left: Readonly<DesktopPositions>,
  right: Readonly<DesktopPositions>,
): boolean {
  const leftIds = Object.keys(left);
  const rightIds = Object.keys(right);
  if (leftIds.length !== rightIds.length) return false;
  return leftIds.every((id) => {
    const a = left[id];
    const b = right[id];
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  });
}

/**
 * Apply a cross-FileManager drop proposal before the incoming NodeIds become
 * visible on Desktop. Existing Desktop entries remain incumbents, while the
 * incoming candidate coordinates are clamped/reconciled by the same canonical
 * placement policy used everywhere else.
 */
export function applyIncomingDesktopDropPositions(
  current: Readonly<DesktopPositions>,
  orderedIds: readonly NodeId[],
  placements: readonly { id: NodeId; x: number; y: number }[],
  workspace: DesktopWorkspace,
): DesktopPositions {
  const candidates: DesktopPositions = { ...current };
  const active = new Set(orderedIds);
  const incomingIds: NodeId[] = [];
  for (const placement of placements) {
    candidates[placement.id] = clampDesktopPosition({ x: placement.x, y: placement.y }, workspace);
    if (!active.has(placement.id)) {
      active.add(placement.id);
      incomingIds.push(placement.id);
    }
  }
  return reconcileDesktopPositions(
    candidates,
    [...orderedIds, ...incomingIds],
    workspace,
    orderedIds,
  );
}

/**
 * Browser input adapter for an explicit user drag. It translates the pointer
 * delta into bounded candidate persisted positions only; it does not perform
 * collision/restore reconciliation or absorb drag/drop command semantics.
 */
export function applyDesktopDragDelta(
  current: Readonly<DesktopPositions>,
  orderedIds: readonly NodeId[],
  ids: readonly NodeId[],
  delta: { dx: number; dy: number },
  workspace: DesktopWorkspace,
): DesktopPositions {
  const next: DesktopPositions = { ...current };
  const indexById = new Map(orderedIds.map((id, index) => [id, index] as const));
  for (const id of ids) {
    const index = indexById.get(id);
    if (index === undefined) continue;
    const origin = current[id] ?? defaultDesktopPosition(index);
    next[id] = clampDesktopPosition({
      x: origin.x + delta.dx,
      y: origin.y + delta.dy,
    }, workspace);
  }
  return next;
}

/**
 * Existing FileManager tests and adapters may hold resource-shaped records;
 * this adapter strips them to NodeIds before delegating to the same pure drag
 * translation. No filesystem/resource semantics cross the boundary.
 */
export function repositionDesktopNodes(
  current: Readonly<DesktopPositions>,
  orderedNodes: readonly { id: NodeId }[],
  ids: readonly NodeId[],
  delta: { dx: number; dy: number },
  workspace: DesktopWorkspace,
): DesktopPositions {
  return applyDesktopDragDelta(current, orderedNodes.map((node) => node.id), ids, delta, workspace);
}
