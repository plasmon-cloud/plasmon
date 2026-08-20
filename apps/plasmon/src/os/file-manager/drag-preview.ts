export interface DragPreviewRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface DragPreviewDelta {
  readonly dx: number;
  readonly dy: number;
}

export type DragOperation = "move" | "copy";

/**
 * Keep the rendered drag ghost on the same geometry model as the source entry.
 * The pointer adapter supplies the entry's browser rectangle and the same drag
 * delta later committed to Desktop placement.
 */
export function translatedDragPreviewRect(
  source: DragPreviewRect,
  delta: DragPreviewDelta,
): DragPreviewRect {
  return {
    left: source.left + delta.dx,
    top: source.top + delta.dy,
    width: source.width,
    height: source.height,
  };
}

/** Presentation text only; canonical target/operation selection remains elsewhere. */
export function dragOperationFeedback(
  operation: DragOperation,
  targetDisplayName: string | null | undefined,
): string | null {
  if (!targetDisplayName) return null;
  const verb = operation === "copy" ? "Copy" : "Move";
  return `${verb} to ${targetDisplayName}`;
}
