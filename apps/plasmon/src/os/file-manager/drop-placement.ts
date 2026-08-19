import type { NodeId } from "../contracts/index.ts";

export interface DropPlacementSourceRect {
  id: NodeId;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface DropPlacementTargetRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface IncomingDropPlacementPoint {
  id: NodeId;
  x: number;
  y: number;
}

export interface IncomingDropPlacementIntent {
  placements: readonly IncomingDropPlacementPoint[];
  workspace: { width: number; height: number };
}

export const FILE_MANAGER_INCOMING_DROP_PLACEMENT_EVENT = "plasmon:file-manager-incoming-drop-placement";

/**
 * Translate the dragged entry rectangles into coordinates owned by the target
 * FileManager surface. The target decides whether/how those candidate positions
 * are persisted; this helper owns no Desktop placement policy.
 */
export function incomingDropPlacementIntent(
  sources: readonly DropPlacementSourceRect[],
  delta: { dx: number; dy: number },
  target: DropPlacementTargetRect,
): IncomingDropPlacementIntent {
  return {
    placements: sources.map((source) => ({
      id: source.id,
      x: source.left + delta.dx - target.left,
      y: source.top + delta.dy - target.top,
    })),
    workspace: { width: target.width, height: target.height },
  };
}

/**
 * Browser-only handoff to the FileManager that owns the hit target. A target
 * prevents the event when it accepted the placement intent. The event carries
 * presentation/placement intent only; filesystem mutation remains separate.
 */
export function dispatchIncomingDropPlacement(
  target: HTMLElement,
  intent: IncomingDropPlacementIntent,
): boolean {
  const event = new CustomEvent<IncomingDropPlacementIntent>(
    FILE_MANAGER_INCOMING_DROP_PLACEMENT_EVENT,
    { bubbles: true, cancelable: true, detail: intent },
  );
  target.dispatchEvent(event);
  return event.defaultPrevented;
}
