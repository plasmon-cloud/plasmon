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

export type IncomingDropPlacementCommit = () => void | Promise<void>;

export interface IncomingDropPlacementRequest {
  intent: IncomingDropPlacementIntent;
  commit: IncomingDropPlacementCommit | null;
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
 * prevents the event when it accepts the placement request and supplies a
 * deferred commit. Dispatch itself never mutates placement: the source invokes
 * the returned commit only after the canonical filesystem move succeeds.
 */
export function dispatchIncomingDropPlacement(
  target: EventTarget,
  intent: IncomingDropPlacementIntent,
): IncomingDropPlacementCommit | null {
  const request: IncomingDropPlacementRequest = { intent, commit: null };
  const event = new CustomEvent<IncomingDropPlacementRequest>(
    FILE_MANAGER_INCOMING_DROP_PLACEMENT_EVENT,
    { bubbles: true, cancelable: true, detail: request },
  );
  target.dispatchEvent(event);
  return event.defaultPrevented ? request.commit : null;
}
