import type { WindowGeometry } from "../contracts/window.ts";
import {
  constrainGeometry,
  type HorizontalSnapSide,
  type WindowViewport,
} from "./geometry.ts";

export type ResizeDirection = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";

export const DEFAULT_HORIZONTAL_SNAP_EDGE_PX = 12;

export interface HorizontalEdgeBounds {
  left: number;
  right: number;
}

const resizeCursors: Record<ResizeDirection, string> = {
  n: "ns-resize",
  ne: "nesw-resize",
  e: "ew-resize",
  se: "nwse-resize",
  s: "ns-resize",
  sw: "nesw-resize",
  w: "ew-resize",
  nw: "nwse-resize",
};

export function resizeCursor(direction: ResizeDirection): string {
  return resizeCursors[direction];
}

export function horizontalSnapSideAtPointer(
  clientX: number,
  bounds: HorizontalEdgeBounds,
  threshold = DEFAULT_HORIZONTAL_SNAP_EDGE_PX,
): HorizontalSnapSide | null {
  const safeThreshold = Math.max(0, Number.isFinite(threshold) ? threshold : DEFAULT_HORIZONTAL_SNAP_EDGE_PX);
  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  if (clientX <= left + safeThreshold) return "left";
  if (clientX >= right - safeThreshold) return "right";
  return null;
}

export function resizeGeometry(
  start: WindowGeometry,
  direction: ResizeDirection,
  deltaX: number,
  deltaY: number,
  viewport: WindowViewport,
  minWidth: number,
  minHeight: number,
): WindowGeometry {
  let { x, y, width, height } = start;
  const east = direction.includes("e");
  const west = direction.includes("w");
  const north = direction.includes("n");
  const south = direction.includes("s");

  if (east) width += deltaX;
  if (south) height += deltaY;
  if (west) {
    x += deltaX;
    width -= deltaX;
  }
  if (north) {
    y += deltaY;
    height -= deltaY;
  }

  if (width < minWidth) {
    if (west) x = start.x + start.width - minWidth;
    width = minWidth;
  }
  if (height < minHeight) {
    if (north) y = start.y + start.height - minHeight;
    height = minHeight;
  }

  return constrainGeometry({ x, y, width, height }, viewport, { minWidth, minHeight });
}

export function suspendIframePointerEvents(owner: Document = document): () => void {
  const previous = Array.from(owner.querySelectorAll("iframe"), (iframe) => [iframe, iframe.style.pointerEvents] as const);
  for (const [iframe] of previous) iframe.style.pointerEvents = "none";
  return () => {
    for (const [iframe, pointerEvents] of previous) iframe.style.pointerEvents = pointerEvents;
  };
}

export function suspendDocumentSelection(cursor?: string, owner: Document = document): () => void {
  const root = owner.documentElement;
  const previousUserSelect = root.style.userSelect;
  const previousCursor = root.style.cursor;
  root.style.userSelect = "none";
  if (cursor) root.style.cursor = cursor;
  return () => {
    root.style.userSelect = previousUserSelect;
    root.style.cursor = previousCursor;
  };
}
