export interface ContextMenuPoint {
  x: number;
  y: number;
}

export interface ContextMenuSize {
  width: number;
  height: number;
}

export interface ContextMenuBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function fitAxis(anchor: number, start: number, end: number, size: number, edgeGap: number): number {
  const minimum = start + edgeGap;
  const maximum = Math.max(minimum, end - size - edgeGap);
  return Math.min(Math.max(anchor, minimum), maximum);
}

/** Keep a fixed-position FileManager context menu inside its owning surface. */
export function fitContextMenuPosition(
  anchor: ContextMenuPoint,
  size: ContextMenuSize,
  bounds: ContextMenuBounds,
  edgeGap = 4,
): ContextMenuPoint {
  return {
    x: fitAxis(anchor.x, bounds.left, bounds.right, size.width, edgeGap),
    y: fitAxis(anchor.y, bounds.top, bounds.bottom, size.height, edgeGap),
  };
}
